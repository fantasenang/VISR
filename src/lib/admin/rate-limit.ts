const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_BUCKETS = 2_000;

type Bucket = { attempts: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function clientAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

function keyFor(request: Request, scope: string) {
  return `${scope}:${clientAddress(request)}`;
}

function prune(now: number) {
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
  if (buckets.size <= MAX_BUCKETS) return;
  for (const key of Array.from(buckets.keys()).slice(0, buckets.size - MAX_BUCKETS)) buckets.delete(key);
}

export function consumeAdminAuthAttempt(request: Request, scope: "login" | "setup") {
  const now = Date.now();
  prune(now);
  const key = keyFor(request, scope);
  const existing = buckets.get(key);
  const bucket = !existing || existing.resetAt <= now
    ? { attempts: 1, resetAt: now + WINDOW_MS }
    : { attempts: existing.attempts + 1, resetAt: existing.resetAt };
  buckets.set(key, bucket);
  return {
    allowed: bucket.attempts <= MAX_ATTEMPTS,
    remaining: Math.max(0, MAX_ATTEMPTS - bucket.attempts),
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

export function clearAdminAuthAttempts(request: Request, scope: "login" | "setup") {
  buckets.delete(keyFor(request, scope));
}
