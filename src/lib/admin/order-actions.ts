import { releaseExpiredVisrReservations } from "@/lib/commerce/reservations";

export const ADMIN_CANCEL_MARKER = "[[VISR_ADMIN_CANCELLED]]";

type OrderRow = {
  id: string;
  order_number: string;
  payment_status: string;
  fulfillment_status: string;
  notes: string | null;
};

type ReservationRow = {
  id: string;
  product_id: string;
  quantity: number;
  status: "active" | "finalized" | "released";
};

type ProductStockRow = {
  id: string;
  stock_total: number;
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

function cancelledNotes(notes: string | null) {
  if (notes?.startsWith(ADMIN_CANCEL_MARKER)) return notes;
  return notes?.trim() ? `${ADMIN_CANCEL_MARKER}\n${notes.trim()}` : ADMIN_CANCEL_MARKER;
}

async function readOrder(orderId: string) {
  const { url, serviceRoleKey } = getConfig();
  const response = await fetch(
    `${url}/rest/v1/orders?select=id,order_number,payment_status,fulfillment_status,notes&id=eq.${encodeURIComponent(orderId)}&limit=1`,
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

async function reconcileCommittedInventory() {
  const { url, serviceRoleKey } = getConfig();
  const [reservationResponse, productResponse] = await Promise.all([
    fetch(
      `${url}/rest/v1/inventory_reservations?select=product_id,quantity,status&status=in.(active,finalized)`,
      { headers: headers(serviceRoleKey), cache: "no-store" },
    ),
    fetch(`${url}/rest/v1/products?select=id,stock_total`, {
      headers: headers(serviceRoleKey),
      cache: "no-store",
    }),
  ]);

  if (!reservationResponse.ok || !productResponse.ok) throw new Error("ORDER_STOCK_RECONCILIATION_READ_FAILED");

  const reservations = (await reservationResponse.json()) as ReservationRow[];
  const products = (await productResponse.json()) as ProductStockRow[];
  const reservedByProduct = new Map<string, number>();
  const soldByProduct = new Map<string, number>();

  for (const reservation of reservations) {
    const quantity = Number(reservation.quantity);
    if (!reservation.product_id || !Number.isFinite(quantity) || quantity <= 0) continue;
    const target = reservation.status === "active" ? reservedByProduct : soldByProduct;
    target.set(reservation.product_id, (target.get(reservation.product_id) ?? 0) + quantity);
  }

  for (const product of products) {
    const total = Math.max(0, Number(product.stock_total) || 0);
    const sold = Math.min(total, Math.max(0, soldByProduct.get(product.id) ?? 0));
    const reserved = Math.min(Math.max(0, total - sold), Math.max(0, reservedByProduct.get(product.id) ?? 0));
    const response = await fetch(`${url}/rest/v1/products?id=eq.${encodeURIComponent(product.id)}`, {
      method: "PATCH",
      headers: headers(serviceRoleKey, { Prefer: "return=minimal" }),
      body: JSON.stringify({ stock_reserved: reserved, stock_sold: sold, updated_at: new Date().toISOString() }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("ORDER_STOCK_RECONCILIATION_FAILED");
  }

  return products.length;
}

async function releaseCommittedReservations(orderId: string) {
  const { url, serviceRoleKey } = getConfig();
  const response = await fetch(
    `${url}/rest/v1/inventory_reservations?order_id=eq.${encodeURIComponent(orderId)}&status=in.(active,finalized)`,
    {
      method: "PATCH",
      headers: headers(serviceRoleKey, { Prefer: "return=representation" }),
      body: JSON.stringify({ status: "released", updated_at: new Date().toISOString() }),
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error("ORDER_RESERVATION_RELEASE_FAILED");
  const rows = (await response.json().catch(() => [])) as ReservationRow[];
  return rows.reduce((total, reservation) => total + Math.max(0, Number(reservation.quantity) || 0), 0);
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
  const notes = cancelledNotes(order.notes);
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
      `${url}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&payment_status=eq.pending`,
      {
        method: "PATCH",
        headers: headers(serviceRoleKey, { Prefer: "return=representation" }),
        body: JSON.stringify({ payment_status: "expired", notes, updated_at: now }),
        cache: "no-store",
      },
    );
    if (!orderResponse.ok) throw new Error("ORDER_CANCELLATION_FAILED");
    const rows = (await orderResponse.json().catch(() => [])) as OrderRow[];
    if (rows.length === 0) {
      const latest = await readOrder(orderId);
      if (latest?.payment_status !== "expired") throw new Error("ORDER_STATUS_CHANGED");
      if (!latest.notes?.startsWith(ADMIN_CANCEL_MARKER)) {
        const markerResponse = await fetch(`${url}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`, {
          method: "PATCH",
          headers: headers(serviceRoleKey, { Prefer: "return=minimal" }),
          body: JSON.stringify({ notes, updated_at: now }),
          cache: "no-store",
        });
        if (!markerResponse.ok) throw new Error("ORDER_CANCELLATION_FAILED");
      }
    }
  } else if (order.payment_status === "paid") {
    const mayRestoreStock = !["shipped", "delivered"].includes(order.fulfillment_status);
    if (mayRestoreStock) {
      restoredUnits = await releaseCommittedReservations(orderId);
      await reconcileCommittedInventory();
    } else {
      stockPolicy = "held";
    }

    const orderResponse = await fetch(
      `${url}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&payment_status=eq.paid`,
      {
        method: "PATCH",
        headers: headers(serviceRoleKey, { Prefer: "return=representation" }),
        body: JSON.stringify({ payment_status: "refunded", notes, updated_at: now }),
        cache: "no-store",
      },
    );
    if (!orderResponse.ok) throw new Error("ORDER_CANCELLATION_FAILED");
    const rows = (await orderResponse.json().catch(() => [])) as OrderRow[];
    if (rows.length === 0) {
      const latest = await readOrder(orderId);
      if (latest?.payment_status !== "refunded") throw new Error("ORDER_STATUS_CHANGED");
    }
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
