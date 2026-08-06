import "server-only";

import { applyPaymentStateFallback } from "@/lib/commerce/payment-state-fallback";
import {
  QRIS_PROVIDER,
  qrisPaymentAmount,
  qrisUniqueCode,
} from "@/lib/commerce/qris-manual";

type PaymentRow = {
  order_id: string;
  amount_idr: number;
  raw_payload: Record<string, unknown> | null;
  updated_at: string;
};

type OrderRow = {
  id: string;
  order_number: string;
  customer_name: string;
  whatsapp: string;
  email: string;
  total_idr: number;
  payment_status: string;
  payment_expires_at: string;
  notes: string | null;
};

export type QrisClaim = {
  orderId: string;
  orderNumber: string;
  customerName: string;
  whatsapp: string;
  email: string;
  totalIdr: number;
  expectedAmountIdr: number;
  uniqueCode: number;
  paymentStatus: string;
  paymentExpiresAt: string;
  claimedAt: string;
};

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("QRIS_ADMIN_NOT_CONFIGURED");
  return { url, serviceRoleKey };
}

function headers(key: string) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export async function getPendingQrisClaims(): Promise<QrisClaim[]> {
  const { url, serviceRoleKey } = config();
  const paymentResponse = await fetch(
    `${url}/rest/v1/payments?select=order_id,amount_idr,raw_payload,updated_at&provider=eq.${QRIS_PROVIDER}&provider_status=eq.claimed&order=updated_at.asc`,
    { headers: headers(serviceRoleKey), cache: "no-store" },
  );
  if (!paymentResponse.ok) throw new Error("QRIS_CLAIM_LIST_FAILED");
  const payments = (await paymentResponse.json()) as PaymentRow[];
  if (payments.length === 0) return [];

  const orderIds = payments.map((payment) => payment.order_id);
  const inFilter = `in.(${orderIds.join(",")})`;
  const orderResponse = await fetch(
    `${url}/rest/v1/orders?select=id,order_number,customer_name,whatsapp,email,total_idr,payment_status,payment_expires_at,notes&id=${encodeURIComponent(inFilter)}`,
    { headers: headers(serviceRoleKey), cache: "no-store" },
  );
  if (!orderResponse.ok) throw new Error("QRIS_CLAIM_ORDER_LIST_FAILED");
  const orders = (await orderResponse.json()) as OrderRow[];
  const orderById = new Map(orders.map((order) => [order.id, order]));

  return payments.flatMap((payment) => {
    const order = orderById.get(payment.order_id);
    if (!order || order.payment_status !== "pending") return [];
    const rawClaimedAt = payment.raw_payload?.claimed_at;
    return [{
      orderId: order.id,
      orderNumber: order.order_number,
      customerName: order.customer_name,
      whatsapp: order.whatsapp,
      email: order.email,
      totalIdr: order.total_idr,
      expectedAmountIdr: payment.amount_idr || qrisPaymentAmount(order.total_idr, order.order_number),
      uniqueCode: qrisUniqueCode(order.order_number),
      paymentStatus: order.payment_status,
      paymentExpiresAt: order.payment_expires_at,
      claimedAt: typeof rawClaimedAt === "string" ? rawClaimedAt : payment.updated_at,
    }];
  });
}

export async function verifyQrisClaim(orderNumber: string) {
  const { url, serviceRoleKey } = config();
  const orderResponse = await fetch(
    `${url}/rest/v1/orders?select=order_number,total_idr,payment_status&order_number=eq.${encodeURIComponent(orderNumber)}&limit=1`,
    { headers: headers(serviceRoleKey), cache: "no-store" },
  );
  if (!orderResponse.ok) throw new Error("QRIS_VERIFY_ORDER_READ_FAILED");
  const order = ((await orderResponse.json()) as Pick<OrderRow, "order_number" | "total_idr" | "payment_status">[])[0];
  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (order.payment_status === "paid") return { alreadyPaid: true };
  if (order.payment_status !== "pending") throw new Error("ORDER_NOT_PENDING");

  const verifiedAt = new Date().toISOString();
  const expectedAmountIdr = qrisPaymentAmount(order.total_idr, order.order_number);
  const result = await applyPaymentStateFallback({
    supabaseUrl: url,
    serviceRoleKey,
    orderNumber: order.order_number,
    paymentStatus: "paid",
    provider: QRIS_PROVIDER,
    amountIdr: expectedAmountIdr,
    providerTransactionId: `qris-bca:${order.order_number}`,
    providerStatus: "manual_verified",
    rawPayload: {
      channel: "bca_static_qris",
      order_number: order.order_number,
      expected_amount_idr: expectedAmountIdr,
      unique_code: qrisUniqueCode(order.order_number),
      verified_at: verifiedAt,
      verification: "VISR Control manual BCA transaction match",
    },
  });

  console.info(JSON.stringify({
    event: "QRIS_PAYMENT_VERIFIED",
    orderNumber: order.order_number,
    expectedAmountIdr,
    verifiedAt,
  }));

  return result;
}
