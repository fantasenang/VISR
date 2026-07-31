import { NextResponse, type NextRequest } from "next/server";
import { getServerPreorderPhase } from "@/lib/commerce/preorder-server";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_BUCKETS = 10_000;

type RateLimitPolicy = { name: string; limit: number };
type RateLimitBucket = { count: number; resetAt: number };
const rateLimitBuckets = new Map<string, RateLimitBucket>();

function resolveRequestId(request: NextRequest) {
  const incoming = request.headers.get("x-request-id")?.trim();
  if (incoming && REQUEST_ID_PATTERN.test(incoming)) return incoming;
  return crypto.randomUUID();
}

function resolveClientAddress(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

function resolveRateLimitPolicy(pathname: string, method: string): RateLimitPolicy | null {
  if (method === "OPTIONS" || pathname === "/api/health") return null;
  if (pathname === "/api/payments/midtrans/webhook") return null;
  if (pathname.includes("lookup")) return { name: "lookup", limit: 12 };
  if (pathname.includes("shipping")) return { name: "shipping", limit: 40 };
  if (pathname.includes("reservation") || pathname.includes("reserve") || pathname === "/api/orders") return { name: "reservation", limit: 10 };
  if (pathname.includes("payment") || pathname.includes("midtrans")) return { name: "payment", limit: 10 };
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) return { name: "api-write", limit: 30 };
  return { name: "api-read", limit: 120 };
}

function consumeRateLimit(key: string, limit: number, now: number) {
  const existing = rateLimitBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const bucket = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitBuckets.set(key, bucket);
    return { allowed: true, remaining: limit - 1, resetAt: bucket.resetAt };
  }
  existing.count += 1;
  rateLimitBuckets.set(key, existing);
  return { allowed: existing.count <= limit, remaining: Math.max(0, limit - existing.count), resetAt: existing.resetAt };
}

function pruneRateLimitBuckets(now: number) {
  if (rateLimitBuckets.size < MAX_BUCKETS) return;
  for (const [key, bucket] of rateLimitBuckets) if (bucket.resetAt <= now) rateLimitBuckets.delete(key);
  if (rateLimitBuckets.size >= MAX_BUCKETS) {
    const oldestKeys = Array.from(rateLimitBuckets.entries()).sort((left, right) => left[1].resetAt - right[1].resetAt).slice(0, Math.ceil(MAX_BUCKETS * 0.1));
    for (const [key] of oldestKeys) rateLimitBuckets.delete(key);
  }
}

function applyRateLimitHeaders(response: NextResponse, policy: RateLimitPolicy, remaining: number, resetAt: number) {
  response.headers.set("RateLimit-Limit", String(policy.limit));
  response.headers.set("RateLimit-Remaining", String(remaining));
  response.headers.set("RateLimit-Reset", String(Math.ceil(resetAt / 1000)));
}

function logRateLimitRejection(request: NextRequest, requestId: string, policy: RateLimitPolicy, retryAfterSeconds: number) {
  console.warn(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "WARN",
    event: "API_RATE_LIMIT_REJECTED",
    requestId,
    policy: policy.name,
    limit: policy.limit,
    method: request.method,
    path: request.nextUrl.pathname,
    retryAfterSeconds,
  }));
}

export function proxy(request: NextRequest) {
  const requestId = resolveRequestId(request);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  if (request.method === "POST" && request.nextUrl.pathname === "/api/orders") {
    const preorderPhase = getServerPreorderPhase();
    if (preorderPhase !== "open") {
      const response = NextResponse.json(
        {
          error: preorderPhase === "upcoming" ? "PREORDER_NOT_OPEN" : "PREORDER_CLOSED",
          requestId,
        },
        { status: 403 },
      );
      response.headers.set("x-request-id", requestId);
      return response;
    }
  }

  const policy = resolveRateLimitPolicy(request.nextUrl.pathname, request.method);
  let rateLimitResult: ReturnType<typeof consumeRateLimit> | null = null;

  if (policy) {
    const now = Date.now();
    pruneRateLimitBuckets(now);
    const bucketKey = `${policy.name}:${resolveClientAddress(request)}`;
    rateLimitResult = consumeRateLimit(bucketKey, policy.limit, now);
    if (!rateLimitResult.allowed) {
      const retryAfterSeconds = Math.max(1, Math.ceil((rateLimitResult.resetAt - now) / 1000));
      logRateLimitRejection(request, requestId, policy, retryAfterSeconds);
      const response = NextResponse.json({ error: "RATE_LIMITED", requestId }, { status: 429 });
      response.headers.set("x-request-id", requestId);
      response.headers.set("Retry-After", String(retryAfterSeconds));
      applyRateLimitHeaders(response, policy, rateLimitResult.remaining, rateLimitResult.resetAt);
      return response;
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-request-id", requestId);
  if (policy && rateLimitResult) applyRateLimitHeaders(response, policy, rateLimitResult.remaining, rateLimitResult.resetAt);
  return response;
}

export const config = { matcher: ["/api/:path*"] };
