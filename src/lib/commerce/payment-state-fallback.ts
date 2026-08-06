import { reconcileInventoryCounters } from "@/lib/commerce/inventory-reconciliation";

export type NormalizedPaymentStatus = "pending" | "paid" | "expired" | "failed";

type OrderRow = {
  id: string;
  order_number: string;
  payment_status: string;
  fulfillment_status: string;
  total_idr: number;
  paid_at: string | null;
};

type PaymentRow = {
  id: string;
  provider_transaction_id: string | null;
};

type ApplyInput = {
  supabaseUrl: string;
  serviceRoleKey: string;
  orderNumber: string;
  paymentStatus: NormalizedPaymentStatus;
  providerTransactionId: string | null;
  providerStatus: string;
  rawPayload: unknown;
  provider?: string;
  amountIdr?: number;
};

type ApplyResult = {
  orderId: string;
  previousStatus: string;
  currentStatus: string;
  applied: boolean;
};

function headers(serviceRoleKey: string, prefer?: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

async function readOrder(input: ApplyInput) {
  const response = await fetch(
    `${input.supabaseUrl}/rest/v1/orders?select=id,order_number,payment_status,fulfillment_status,total_idr,paid_at&order_number=eq.${encodeURIComponent(input.orderNumber)}&limit=1`,
    { headers: headers(input.serviceRoleKey), cache: "no-store" },
  );
  if (!response.ok) throw new Error("PAYMENT_FALLBACK_ORDER_READ_FAILED");
  const rows = (await response.json()) as OrderRow[];
  return rows[0] ?? null;
}

function transitionAllowed(previous: string, next: NormalizedPaymentStatus) {
  if (previous === "pending") return ["pending", "paid", "expired", "failed"].includes(next);
  if (previous === "paid") return next === "paid";
  if (previous === "failed") return next === "failed" || next === "paid";
  if (previous === "expired") return next === "expired";
  if (previous === "refunded") return false;
  return false;
}

async function updateOrder(input: ApplyInput, order: OrderRow) {
  if (order.payment_status === input.paymentStatus) return false;
  if (!transitionAllowed(order.payment_status, input.paymentStatus)) {
    throw new Error(`INVALID_PAYMENT_STATUS_TRANSITION:${order.payment_status}->${input.paymentStatus}`);
  }

  const response = await fetch(
    `${input.supabaseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(order.id)}&payment_status=eq.${encodeURIComponent(order.payment_status)}`,
    {
      method: "PATCH",
      headers: headers(input.serviceRoleKey, "return=representation"),
      body: JSON.stringify({
        payment_status: input.paymentStatus,
        ...(input.paymentStatus === "paid"
          ? {
              paid_at: order.paid_at ?? new Date().toISOString(),
              fulfillment_status: order.fulfillment_status === "pending" ? "confirmed" : order.fulfillment_status,
            }
          : {}),
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) throw new Error("PAYMENT_FALLBACK_ORDER_UPDATE_FAILED");
  const rows = (await response.json().catch(() => [])) as OrderRow[];
  if (rows.length === 0) {
    const latest = await readOrder(input);
    if (!latest || latest.payment_status !== input.paymentStatus) {
      throw new Error("PAYMENT_FALLBACK_ORDER_STATUS_CHANGED");
    }
    return false;
  }
  return true;
}

async function transitionReservations(input: ApplyInput, orderId: string) {
  const nextReservationStatus = input.paymentStatus === "paid"
    ? "finalized"
    : input.paymentStatus === "expired" || input.paymentStatus === "failed"
      ? "released"
      : null;
  if (!nextReservationStatus) return;

  const response = await fetch(
    `${input.supabaseUrl}/rest/v1/inventory_reservations?order_id=eq.${encodeURIComponent(orderId)}&status=eq.active`,
    {
      method: "PATCH",
      headers: headers(input.serviceRoleKey, "return=minimal"),
      body: JSON.stringify({ status: nextReservationStatus, updated_at: new Date().toISOString() }),
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error("PAYMENT_FALLBACK_RESERVATION_UPDATE_FAILED");

  await reconcileInventoryCounters({ force: true, minimumIntervalMs: 0 });
}

async function updatePayment(input: ApplyInput, order: OrderRow) {
  const provider = input.provider ?? "midtrans";
  const readResponse = await fetch(
    `${input.supabaseUrl}/rest/v1/payments?select=id,provider_transaction_id&order_id=eq.${encodeURIComponent(order.id)}&provider=eq.${encodeURIComponent(provider)}&limit=1`,
    { headers: headers(input.serviceRoleKey), cache: "no-store" },
  );
  if (!readResponse.ok) throw new Error("PAYMENT_FALLBACK_PAYMENT_READ_FAILED");
  const rows = (await readResponse.json()) as PaymentRow[];
  const payment = rows[0];

  if (
    payment?.provider_transaction_id &&
    input.providerTransactionId &&
    payment.provider_transaction_id !== input.providerTransactionId
  ) {
    throw new Error("PAYMENT_TRANSACTION_ALREADY_ASSIGNED");
  }

  const body = {
    provider_transaction_id: payment?.provider_transaction_id ?? input.providerTransactionId,
    provider_status: input.providerStatus,
    amount_idr: input.amountIdr ?? order.total_idr,
    raw_payload: input.rawPayload,
    updated_at: new Date().toISOString(),
  };

  if (payment) {
    const response = await fetch(
      `${input.supabaseUrl}/rest/v1/payments?id=eq.${encodeURIComponent(payment.id)}`,
      {
        method: "PATCH",
        headers: headers(input.serviceRoleKey, "return=minimal"),
        body: JSON.stringify(body),
        cache: "no-store",
      },
    );
    if (!response.ok) throw new Error("PAYMENT_FALLBACK_PAYMENT_UPDATE_FAILED");
    return;
  }

  const response = await fetch(`${input.supabaseUrl}/rest/v1/payments`, {
    method: "POST",
    headers: headers(input.serviceRoleKey, "return=minimal"),
    body: JSON.stringify({
      order_id: order.id,
      provider,
      ...body,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("PAYMENT_FALLBACK_PAYMENT_INSERT_FAILED");
}

export async function applyPaymentStateFallback(input: ApplyInput): Promise<ApplyResult> {
  const order = await readOrder(input);
  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (!transitionAllowed(order.payment_status, input.paymentStatus)) {
    throw new Error(`INVALID_PAYMENT_STATUS_TRANSITION:${order.payment_status}->${input.paymentStatus}`);
  }

  const applied = await updateOrder(input, order);
  await transitionReservations(input, order.id);
  await updatePayment(input, order);

  return {
    orderId: order.id,
    previousStatus: order.payment_status,
    currentStatus: input.paymentStatus,
    applied,
  };
}
