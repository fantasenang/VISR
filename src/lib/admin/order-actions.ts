import { releaseExpiredVisrReservations } from "@/lib/commerce/reservations";

type OrderRow = {
  id: string;
  order_number: string;
  payment_status: string;
  fulfillment_status: string;
};

type ReservationRow = {
  id: string;
  product_id: string;
  quantity: number;
  status: "active" | "finalized" | "released";
};

type ProductStockRow = {
  id: string;
  stock_sold: number;
};

function getConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("ADMIN_ORDER_ACTION_NOT_CONFIGURED");
  return { url, serviceRoleKey };
}

function headers(serviceRoleKey: string, extra: Record<string, string> = {}) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function readOrder(orderId: string) {
  const { url, serviceRoleKey } = getConfig();
  const response = await fetch(
    `${url}/rest/v1/orders?select=id,order_number,payment_status,fulfillment_status&id=eq.${encodeURIComponent(orderId)}&limit=1`,
    { headers: headers(serviceRoleKey), cache: "no-store" },
  );
  if (!response.ok) throw new Error("ORDER_STATUS_READ_FAILED");
  const rows = (await response.json()) as OrderRow[];
  return rows[0] ?? null;
}

async function readReservations(orderId: string) {
  const { url, serviceRoleKey } = getConfig();
  const response = await fetch(
    `${url}/rest/v1/inventory_reservations?select=id,product_id,quantity,status&order_id=eq.${encodeURIComponent(orderId)}`,
    { headers: headers(serviceRoleKey), cache: "no-store" },
  );
  if (!response.ok) throw new Error("ORDER_RESERVATION_READ_FAILED");
  return (await response.json()) as ReservationRow[];
}

async function decrementSoldStock(productId: string, quantity: number) {
  const { url, serviceRoleKey } = getConfig();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const productResponse = await fetch(
      `${url}/rest/v1/products?select=id,stock_sold&id=eq.${encodeURIComponent(productId)}&limit=1`,
      { headers: headers(serviceRoleKey), cache: "no-store" },
    );
    if (!productResponse.ok) throw new Error("ORDER_STOCK_READ_FAILED");
    const products = (await productResponse.json()) as ProductStockRow[];
    const product = products[0];
    if (!product) throw new Error("ORDER_PRODUCT_NOT_FOUND");

    const currentSold = Math.max(0, Number(product.stock_sold) || 0);
    const nextSold = Math.max(0, currentSold - Math.max(0, quantity));
    const updateResponse = await fetch(
      `${url}/rest/v1/products?id=eq.${encodeURIComponent(productId)}&stock_sold=eq.${encodeURIComponent(String(currentSold))}`,
      {
        method: "PATCH",
        headers: headers(serviceRoleKey, { Prefer: "return=representation" }),
        body: JSON.stringify({ stock_sold: nextSold, updated_at: new Date().toISOString() }),
        cache: "no-store",
      },
    );
    if (!updateResponse.ok) throw new Error("ORDER_STOCK_RESTORE_FAILED");
    const updated = (await updateResponse.json().catch(() => [])) as ProductStockRow[];
    if (updated.length > 0) return currentSold - nextSold;
  }

  throw new Error("ORDER_STOCK_CONFLICT");
}

async function releaseFinalizedReservation(reservation: ReservationRow) {
  const restoredQuantity = await decrementSoldStock(reservation.product_id, Number(reservation.quantity));
  const { url, serviceRoleKey } = getConfig();
  const response = await fetch(
    `${url}/rest/v1/inventory_reservations?id=eq.${encodeURIComponent(reservation.id)}&status=eq.finalized`,
    {
      method: "PATCH",
      headers: headers(serviceRoleKey, { Prefer: "return=representation" }),
      body: JSON.stringify({ status: "released", updated_at: new Date().toISOString() }),
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error("ORDER_RESERVATION_RELEASE_FAILED");
  return restoredQuantity;
}

export async function cancelVisrOrder(orderId: string) {
  const order = await readOrder(orderId);
  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (["expired", "failed", "refunded"].includes(order.payment_status)) {
    throw new Error("ORDER_ALREADY_ARCHIVED");
  }

  const { url, serviceRoleKey } = getConfig();
  const now = new Date().toISOString();
  const reservations = await readReservations(orderId);
  let restoredUnits = 0;
  let stockPolicy: "restored" | "held" = "restored";

  if (order.payment_status === "pending") {
    const activeReservations = reservations.filter((reservation) => reservation.status === "active");
    if (activeReservations.length > 0) {
      const reservationResponse = await fetch(
        `${url}/rest/v1/inventory_reservations?order_id=eq.${encodeURIComponent(orderId)}&status=eq.active`,
        {
          method: "PATCH",
          headers: headers(serviceRoleKey, { Prefer: "return=minimal" }),
          body: JSON.stringify({ expires_at: now, updated_at: now }),
          cache: "no-store",
        },
      );
      if (!reservationResponse.ok) throw new Error("ORDER_CANCELLATION_FAILED");
      await releaseExpiredVisrReservations();
      restoredUnits = activeReservations.reduce((total, reservation) => total + Number(reservation.quantity), 0);
    }

    const orderResponse = await fetch(
      `${url}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`,
      {
        method: "PATCH",
        headers: headers(serviceRoleKey, { Prefer: "return=representation" }),
        body: JSON.stringify({ payment_status: "expired", updated_at: now }),
        cache: "no-store",
      },
    );
    if (!orderResponse.ok) throw new Error("ORDER_CANCELLATION_FAILED");
  } else if (order.payment_status === "paid") {
    const mayRestoreStock = !["shipped", "delivered"].includes(order.fulfillment_status);
    if (mayRestoreStock) {
      for (const reservation of reservations.filter((item) => item.status === "finalized")) {
        restoredUnits += await releaseFinalizedReservation(reservation);
      }
    } else {
      stockPolicy = "held";
    }

    const orderResponse = await fetch(
      `${url}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&payment_status=eq.paid`,
      {
        method: "PATCH",
        headers: headers(serviceRoleKey, { Prefer: "return=representation" }),
        body: JSON.stringify({ payment_status: "refunded", updated_at: now }),
        cache: "no-store",
      },
    );
    if (!orderResponse.ok) throw new Error("ORDER_CANCELLATION_FAILED");
    const rows = (await orderResponse.json().catch(() => [])) as OrderRow[];
    if (rows.length === 0) throw new Error("ORDER_STATUS_CHANGED");
  } else {
    throw new Error("ORDER_NOT_CANCELLABLE");
  }

  console.info(
    JSON.stringify({
      event: "ADMIN_ORDER_CANCELLED",
      orderId,
      orderNumber: order.order_number,
      previousPaymentStatus: order.payment_status,
      fulfillmentStatus: order.fulfillment_status,
      nextPaymentStatus: order.payment_status === "paid" ? "refunded" : "expired",
      restoredUnits,
      stockPolicy,
      timestamp: now,
    }),
  );

  return {
    id: order.id,
    orderNumber: order.order_number,
    previousPaymentStatus: order.payment_status,
    paymentStatus: order.payment_status === "paid" ? "refunded" : "expired",
    restoredUnits,
    stockPolicy,
    manualRefundRequired: order.payment_status === "paid",
  };
}
