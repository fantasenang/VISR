type OrderStatusRow = {
  id: string;
  order_number: string;
  payment_status: string;
};

type ActiveReservationRow = {
  product_id: string;
  quantity: number;
};

type ProductStockRow = {
  id: string;
  stock_total: number;
  stock_reserved: number;
  stock_sold: number;
};

function getConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("RESERVATION_SERVICE_NOT_CONFIGURED");
  return { url, serviceRoleKey };
}

function requestHeaders(serviceRoleKey: string, extra: Record<string, string> = {}) {
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
    `${url}/rest/v1/orders?select=id,order_number,payment_status&id=eq.${encodeURIComponent(orderId)}&limit=1`,
    {
      headers: requestHeaders(serviceRoleKey),
      cache: "no-store",
    },
  );

  if (!response.ok) throw new Error("ORDER_STATUS_READ_FAILED");
  const rows = (await response.json()) as OrderStatusRow[];
  return rows[0] ?? null;
}

async function callReleaseExpiredReservations(url: string, serviceRoleKey: string) {
  return fetch(`${url}/rest/v1/rpc/release_expired_visr_reservations`, {
    method: "POST",
    headers: requestHeaders(serviceRoleKey),
    body: "{}",
    cache: "no-store",
  });
}

async function repairUnderstatedReservedStock(url: string, serviceRoleKey: string) {
  const reservationsResponse = await fetch(
    `${url}/rest/v1/inventory_reservations?select=product_id,quantity&status=eq.active`,
    {
      headers: requestHeaders(serviceRoleKey),
      cache: "no-store",
    },
  );

  if (!reservationsResponse.ok) throw new Error("RESERVATION_REPAIR_READ_FAILED");
  const reservations = (await reservationsResponse.json()) as ActiveReservationRow[];

  const expectedByProduct = new Map<string, number>();
  for (const reservation of reservations) {
    const quantity = Number(reservation.quantity);
    if (!reservation.product_id || !Number.isFinite(quantity) || quantity <= 0) continue;
    expectedByProduct.set(reservation.product_id, (expectedByProduct.get(reservation.product_id) ?? 0) + quantity);
  }

  if (expectedByProduct.size === 0) return 0;

  const productsResponse = await fetch(
    `${url}/rest/v1/products?select=id,stock_total,stock_reserved,stock_sold`,
    {
      headers: requestHeaders(serviceRoleKey),
      cache: "no-store",
    },
  );

  if (!productsResponse.ok) throw new Error("RESERVATION_REPAIR_PRODUCT_READ_FAILED");
  const products = (await productsResponse.json()) as ProductStockRow[];
  let repairedProducts = 0;

  for (const product of products) {
    const expected = expectedByProduct.get(product.id) ?? 0;
    const current = Number(product.stock_reserved);
    const capacity = Math.max(0, Number(product.stock_total) - Number(product.stock_sold));
    const repairedValue = Math.min(expected, capacity);

    if (!Number.isFinite(current) || repairedValue <= current) continue;

    const response = await fetch(
      `${url}/rest/v1/products?id=eq.${encodeURIComponent(product.id)}&stock_reserved=eq.${encodeURIComponent(String(current))}`,
      {
        method: "PATCH",
        headers: requestHeaders(serviceRoleKey, { Prefer: "return=representation" }),
        body: JSON.stringify({ stock_reserved: repairedValue, updated_at: new Date().toISOString() }),
        cache: "no-store",
      },
    );

    if (!response.ok) throw new Error("RESERVATION_REPAIR_UPDATE_FAILED");
    const updatedRows = (await response.json().catch(() => [])) as ProductStockRow[];
    if (updatedRows.length > 0) repairedProducts += 1;
  }

  return repairedProducts;
}

export async function releaseExpiredVisrReservations() {
  const { url, serviceRoleKey } = getConfig();
  let response = await callReleaseExpiredReservations(url, serviceRoleKey);
  let initialFailure = "";

  if (!response.ok) {
    initialFailure = await response.text().catch(() => "");
    const isReservedStockUnderflow =
      response.status === 400 &&
      (initialFailure.includes("products_stock_reserved_check") || initialFailure.includes('"23514"'));

    if (isReservedStockUnderflow) {
      const repairedProducts = await repairUnderstatedReservedStock(url, serviceRoleKey);
      console.warn(
        JSON.stringify({
          event: "RESERVATION_STOCK_REPAIRED",
          repairedProducts,
          timestamp: new Date().toISOString(),
        }),
      );
      response = await callReleaseExpiredReservations(url, serviceRoleKey);
    }
  }

  if (!response.ok) {
    const failure = initialFailure || await response.text().catch(() => "");
    console.error(
      JSON.stringify({
        event: "RESERVATION_EXPIRY_FAILED",
        status: response.status,
        failure,
        timestamp: new Date().toISOString(),
      }),
    );
    throw new Error("RESERVATION_EXPIRY_FAILED");
  }

  const payload = (await response.json().catch(() => 0)) as number | string | null;
  const releasedReservations = Number(payload ?? 0);

  if (releasedReservations > 0) {
    console.info(
      JSON.stringify({
        event: "RESERVATIONS_EXPIRED",
        releasedReservations,
        timestamp: new Date().toISOString(),
      }),
    );
  }

  return Number.isFinite(releasedReservations) ? releasedReservations : 0;
}

export async function cancelPendingVisrOrder(orderId: string) {
  const order = await readOrder(orderId);
  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (order.payment_status !== "pending") throw new Error("ORDER_NOT_PENDING");

  const { url, serviceRoleKey } = getConfig();
  const now = new Date().toISOString();

  const reservationResponse = await fetch(
    `${url}/rest/v1/inventory_reservations?order_id=eq.${encodeURIComponent(orderId)}&status=eq.active`,
    {
      method: "PATCH",
      headers: requestHeaders(serviceRoleKey, { Prefer: "return=minimal" }),
      body: JSON.stringify({ expires_at: now, updated_at: now }),
      cache: "no-store",
    },
  );

  if (!reservationResponse.ok) throw new Error("ORDER_CANCELLATION_FAILED");

  const releasedReservations = await releaseExpiredVisrReservations();

  const orderResponse = await fetch(
    `${url}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&payment_status=eq.pending`,
    {
      method: "PATCH",
      headers: requestHeaders(serviceRoleKey, { Prefer: "return=representation" }),
      body: JSON.stringify({ payment_status: "expired", updated_at: now }),
      cache: "no-store",
    },
  );

  if (!orderResponse.ok) throw new Error("ORDER_CANCELLATION_FAILED");

  const finalOrder = await readOrder(orderId);
  if (!finalOrder) throw new Error("ORDER_NOT_FOUND");
  if (finalOrder.payment_status !== "expired") throw new Error("ORDER_NOT_PENDING");

  console.info(
    JSON.stringify({
      event: "ADMIN_PENDING_ORDER_CANCELLED",
      orderId,
      orderNumber: order.order_number,
      releasedReservations,
      timestamp: now,
    }),
  );

  return {
    id: finalOrder.id,
    orderNumber: finalOrder.order_number,
    paymentStatus: finalOrder.payment_status,
    releasedReservations,
  };
}
