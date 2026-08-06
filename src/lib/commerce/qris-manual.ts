import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export const QRIS_PROVIDER = "qris_bca";
export const QRIS_NMID = "ID1026565261819";
export const QRIS_TERMINAL = "A01";

function sessionSecret() {
  const secret =
    process.env.QRIS_SESSION_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) throw new Error("QRIS_SESSION_NOT_CONFIGURED");
  return secret;
}

export function qrisUniqueCode(orderNumber: string) {
  const lastPart = orderNumber.split(".").at(-1) ?? "";
  const parsed = Number.parseInt(lastPart, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return ((parsed - 1) % 999) + 1;
}

export function qrisPaymentAmount(totalIdr: number, orderNumber: string) {
  return totalIdr + qrisUniqueCode(orderNumber);
}

export function signQrisOrder(orderNumber: string) {
  return createHmac("sha256", sessionSecret())
    .update(orderNumber)
    .digest("base64url");
}

export function verifyQrisOrderToken(orderNumber: string, token: string) {
  if (!token) return false;
  const expected = signQrisOrder(orderNumber);
  const expectedBuffer = Buffer.from(expected);
  const tokenBuffer = Buffer.from(token);
  if (expectedBuffer.length !== tokenBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, tokenBuffer);
}
