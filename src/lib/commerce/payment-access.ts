import "server-only";

import { createHash } from "node:crypto";

type ConsumeResult = {
  allowed: boolean;
  order_number: string | null;
  payment_expires_at: string | null;
};

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("PAYMENT_ACCESS_NOT_CONFIGURED");
  return { url, serviceRoleKey };
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function consumePaymentAccess(orderId: string) {
  const { url, serviceRoleKey } = config();
  const response = await fetch(`${url}/rest/v1/rpc/consume_order_payment_access`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_order_id: orderId,
      p_token_hash: tokenHash(orderId),
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("PAYMENT_ACCESS_VALIDATION_FAILED");
  const payload = (await response.json()) as ConsumeResult[] | ConsumeResult;
  const result = Array.isArray(payload) ? payload[0] : payload;
  return {
    allowed: Boolean(result?.allowed),
    orderNumber: result?.order_number ?? null,
    expiresAt: result?.payment_expires_at ?? null,
  };
}
