import { NextResponse, type NextRequest } from "next/server";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_BUCKETS = 10_000;
const MAX_JSON_BODY_BYTES = 64 * 1024;
const MAX_PAYMENT_PROOF_BODY_BYTES = 4_500_000;
const QRIS_PROOF_UPLOAD_PATH = "/api/payments/qris/proof";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const ORIGIN_EXEMPT_PATHS = new Set([
  "/api/payments/midtrans/webhook",
]);

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

function apiError(requestId: string, code: string, message: string, status: number) {
  const response = NextResponse.json(
    { error: { code, message }, requestId },
    { status },
  );
  response.headers.set("x-request-id", requestId);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

function logSecurityEvent(
  level: "WARN" | "ERROR",
  event: string,
  request: NextRequest,
  requestId: string,
  details: Record<string, unknown> = {},
) {
  const payload = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    requestId,
    method: request.method,
    path: request.nextUrl.pathname,
    ...details,
  });
  if (level === "ERROR") console.error(payload);
  else console.warn(payload);
}

function allowedOrigins(request: NextRequest) {
  const origins = new Set<string>([request.nextUrl.origin]);
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) {
    try {
      origins.add(new URL(configured).origin);
    } catch {
      // Invalid configuration is logged when an origin-protected request arrives.
    }
  }
  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
  }
  return origins;
}

function hasValidBrowserOrigin(request: NextRequest) {
  if (!MUTATING_METHODS.has(request.method)) return true;
  if (ORIGIN_EXEMPT_PATHS.has(request.nextUrl.pathname)) return true;

  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  // Non-browser/server-to-server clients commonly omit Origin and Sec-Fetch-Site.
  // Browser requests must be same-origin/same-site and use an explicitly allowed origin.
  if (!origin && !fetchSite) return true;
  if (!origin) return false;
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) return false;

  try {
    return allowedOrigins(request).has(new URL(origin).origin);
  } catch {
    return false;
  }
}

function bodySizeLimit(request: NextRequest) {
  return request.method === "POST" && request.nextUrl.pathname === QRIS_PROOF_UPLOAD_PATH
    ? MAX_PAYMENT_PROOF_BODY_BYTES
    : MAX_JSON_BODY_BYTES;
}

function hasAcceptableBodySize(request: NextRequest) {
  if (!MUTATING_METHODS.has(request.method)) return true;
  const contentLength = request.headers.get("content-length");
  if (!contentLength) return true;
  const bytes = Number(contentLength);
  return Number.isInteger(bytes) && bytes >= 0 && bytes <= bodySizeLimit(request);
}

function hasSupportedContentType(request: NextRequest) {
  if (!MUTATING_METHODS.has(request.method)) return true;
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength === 0) return true;
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (request.method === "POST" && request.nextUrl.pathname === QRIS_PROOF_UPLOAD_PATH) {
    return contentType.startsWith("multipart/form-data;");
  }
  return contentType.startsWith("application/json");
}

function resolveRateLimitPolicy(pathname: string, method: string): RateLimitPolicy | null {
  if (method === "OPTIONS" || pathname === "/api/health") return null;
  if (pathname === "/api/payments/midtrans/webhook") return null;
  if (pathname.includes("lookup") || pathname.includes("tracking")) return { name: "tracking", limit: 12 };
  if (pathname.includes("shipping")) return { name: "shipping", limit: 40 };
  if (pathname.includes("reservation") || pathname.includes("reserve") || pathname === "/api/orders") return { name: "reservation", limit: 10 };
  if (pathname.includes("payment") || pathname.includes("midtrans")) return { name: "payment", limit: 10 };
  if (MUTATING_METHODS.has(method)) return { name: "api-write", limit: 30 };
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
    const oldestKeys = Array.from(rateLimitBuckets.entries())
      .sort((left, right) => left[1].resetAt - right[1].resetAt)
      .slice(0, Math.ceil(MAX_BUCKETS * 0.1));
    for (const [key] of oldestKeys) rateLimitBuckets.delete(key);
  }
}

function applyRateLimitHeaders(response: NextResponse, policy: RateLimitPolicy, remaining: number, resetAt: number) {
  response.headers.set("RateLimit-Limit", String(policy.limit));
  response.headers.set("RateLimit-Remaining", String(remaining));
  response.headers.set("RateLimit-Reset", String(Math.ceil(resetAt / 1000)));
}

export function proxy(request: NextRequest) {
  const requestId = resolveRequestId(request);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  if (!hasAcceptableBodySize(request)) {
    const maximumBytes = bodySizeLimit(request);
    logSecurityEvent("WARN", "API_BODY_TOO_LARGE", request, requestId, {
      contentLength: request.headers.get("content-length"),
      maximumBytes,
    });
    return apiError(requestId, "PAYLOAD_TOO_LARGE", `Request body exceeds the ${maximumBytes} byte limit.`, 413);
  }

  if (!hasSupportedContentType(request)) {
    logSecurityEvent("WARN", "API_UNSUPPORTED_MEDIA_TYPE", request, requestId, {
      contentType: request.headers.get("content-type"),
    });
    return apiError(requestId, "UNSUPPORTED_MEDIA_TYPE", "Use the supported content type for this endpoint.", 415);
  }

  if (!hasValidBrowserOrigin(request)) {
    logSecurityEvent("WARN", "API_ORIGIN_REJECTED", request, requestId, {
      origin: request.headers.get("origin"),
      fetchSite: request.headers.get("sec-fetch-site"),
    });
    return apiError(requestId, "INVALID_ORIGIN", "This request origin is not allowed.", 403);
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
      logSecurityEvent("WARN", "API_RATE_LIMIT_REJECTED", request, requestId, {
        policy: policy.name,
        limit: policy.limit,
        retryAfterSeconds,
      });
      const response = apiError(requestId, "RATE_LIMITED", "Too many requests. Try again later.", 429);
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
