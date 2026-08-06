import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const QRIS_PROVIDER = "qris_bca";
export const QRIS_NMID = "ID1026565261819";
export const QRIS_TERMINAL = "A01";
const QRIS_SESSION_TTL_MS = 30 * 60 * 1000;

type QrisSessionPayload = {
  orderNumber: string;
  nonce: string;
  expiresAt: number;
};

function sessionSecret() {
  const secret = process.env.QRIS_SESSION_SECRET || process.env.AUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("QRIS_SESSION_NOT_CONFIGURED");
  return secret;
}

function signature(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

function secureEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
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

export function signQrisOrder(orderNumber: string, expiresAt?: string | number) {
  const requestedExpiry = typeof expiresAt === "string" ? new Date(expiresAt).getTime() : expiresAt;
  const expiry = Math.min(
    Number.isFinite(requestedExpiry) ? Number(requestedExpiry) : Date.now() + QRIS_SESSION_TTL_MS,
    Date.now() + QRIS_SESSION_TTL_MS,
  );
  const value: QrisSessionPayload = {
    orderNumber,
    nonce: randomBytes(18).toString("base64url"),
    expiresAt: expiry,
  };
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyQrisOrderToken(orderNumber: string, token: string) {
  if (!token) return false;
  const separator = token.lastIndexOf(".");
  if (separator < 1) return false;
  const payload = token.slice(0, separator);
  const suppliedSignature = token.slice(separator + 1);
  if (!secureEqual(suppliedSignature, signature(payload))) return false;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as QrisSessionPayload;
    return value.orderNumber === orderNumber
      && typeof value.nonce === "string"
      && /^[A-Za-z0-9_-]{20,40}$/.test(value.nonce)
      && Number.isFinite(value.expiresAt)
      && value.expiresAt > Date.now();
  } catch {
    return false;
  }
}
