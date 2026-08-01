type OrderStatusRow = {
  id: string;
  order_number: string;
  payment_status: string;
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

export async function releaseExpiredVisrReservations() {
  const { url, serviceRoleKey } = getConfig();
  const response = await fetch(`${url}/rest/v1/rpc/release_expired_visr_reservations`, {
    method: "POST",
    headers: requestHeaders(serviceRoleKey),
    body: "{}",
    cache: "no-store",
  });

  if (!response.ok) {
    const failure = await response.text().catch(() => "");
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
