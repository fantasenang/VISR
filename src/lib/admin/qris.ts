import "server-only";

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

type ProofRow = { order_id: string };

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

type AtomicVerificationRow = {
  order_id: string;
  already_paid: boolean;
  finalized_reservations: number;
  current_status: string;
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
  proofAvailable: boolean;
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
  const [orderResponse, proofResponse] = await Promise.all([
    fetch(
      `${url}/rest/v1/orders?select=id,order_number,customer_name,whatsapp,email,total_idr,payment_status,payment_expires_at,notes&id=${encodeURIComponent(inFilter)}`,
      { headers: headers(serviceRoleKey), cache: "no-store" },
    ),
    fetch(
      `${url}/rest/v1/qris_payment_proofs?select=order_id&order_id=${encodeURIComponent(inFilter)}`,
      { headers: headers(serviceRoleKey), cache: "no-store" },
    ),
  ]);
  if (!orderResponse.ok) throw new Error("QRIS_CLAIM_ORDER_LIST_FAILED");
  if (!proofResponse.ok) throw new Error("QRIS_CLAIM_PROOF_LIST_FAILED");

  const orders = (await orderResponse.json()) as OrderRow[];
  const proofs = (await proofResponse.json()) as ProofRow[];
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const proofOrderIds = new Set(proofs.map((proof) => proof.order_id));

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
      proofAvailable: proofOrderIds.has(order.id),
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

  const verifiedAt = new Date().toISOString();
  const expectedAmountIdr = qrisPaymentAmount(order.total_idr, order.order_number);
  const rpcResponse = await fetch(`${url}/rest/v1/rpc/verify_qris_payment`, {
    method: "POST",
    headers: headers(serviceRoleKey),
    body: JSON.stringify({
      p_order_number: order.order_number,
      p_expected_amount_idr: expectedAmountIdr,
      p_verified_at: verifiedAt,
    }),
    cache: "no-store",
  });
  if (!rpcResponse.ok) {
    const failure = await rpcResponse.text().catch(() => "");
    throw new Error(`QRIS_ATOMIC_VERIFICATION_FAILED:${rpcResponse.status}:${failure.slice(0, 160)}`);
  }
  const payload = (await rpcResponse.json()) as AtomicVerificationRow[] | AtomicVerificationRow;
  const result = Array.isArray(payload) ? payload[0] : payload;
  if (!result?.order_id) throw new Error("QRIS_ATOMIC_VERIFICATION_EMPTY");

  console.info(JSON.stringify({
    event: "QRIS_PAYMENT_VERIFIED_ATOMICALLY",
    orderId: result.order_id,
    orderNumber: order.order_number,
    expectedAmountIdr,
    finalizedReservations: result.finalized_reservations,
    alreadyPaid: result.already_paid,
    verifiedAt,
  }));

  return {
    orderId: result.order_id,
    alreadyPaid: result.already_paid,
    finalizedReservations: result.finalized_reservations,
    currentStatus: result.current_status,
  };
}
