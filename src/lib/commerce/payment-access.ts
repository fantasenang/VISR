import "server-only";

import { createHash, randomBytes } from "node:crypto";

export const PAYMENT_ACCESS_COOKIE = "visr_payment_access";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,80}$/;

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

function headers(serviceRoleKey: string, prefer?: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function cookieValue(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return "";
}

export function paymentAccessCookieOptions(expiresAt?: string) {
  const expiryMs = expiresAt ? new Date(expiresAt).getTime() : Date.now() + 15 * 60 * 1000;
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: Math.max(0, Math.min(24 * 60 * 60, Math.floor((expiryMs - Date.now()) / 1000))),
  };
}

export async function createPaymentAccess(orderId: string, expiresAt: string) {
  const token = randomBytes(32).toString("base64url");
  const { url, serviceRoleKey } = config();
  const response = await fetch(
    `${url}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&payment_status=eq.pending`,
    {
      method: "PATCH",
      headers: headers(serviceRoleKey, "return=representation"),
      body: JSON.stringify({
        payment_access_token_hash: tokenHash(token),
        payment_access_token_consumed_at: null,
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error("PAYMENT_ACCESS_WRITE_FAILED");
  const rows = (await response.json().catch(() => [])) as Array<{ id: string }>;
  if (rows.length !== 1) throw new Error("PAYMENT_ACCESS_ORDER_NOT_PENDING");
  return {
    value: `${orderId}.${token}`,
    options: paymentAccessCookieOptions(expiresAt),
  };
}

export async function consumePaymentAccess(request: Request, expectedOrderId: string) {
  const encoded = cookieValue(request, PAYMENT_ACCESS_COOKIE);
  const separator = encoded.indexOf(".");
  if (separator < 1) return { allowed: false as const };
  const orderId = encoded.slice(0, separator);
  const token = encoded.slice(separator + 1);
  if (orderId !== expectedOrderId || !TOKEN_PATTERN.test(token)) return { allowed: false as const };

  const { url, serviceRoleKey } = config();
  const response = await fetch(`${url}/rest/v1/rpc/consume_order_payment_access`, {
    method: "POST",
    headers: headers(serviceRoleKey),
    body: JSON.stringify({
      p_order_id: expectedOrderId,
      p_token_hash: tokenHash(token),
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
