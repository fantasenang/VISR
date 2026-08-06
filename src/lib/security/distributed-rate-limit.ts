type DistributedRateLimitResult = {
  allowed: boolean;
  remaining: number;
  reset_at: string;
};

async function stableKey(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function consumeDistributedRateLimit(
  identity: string,
  limit: number,
  windowSeconds = 60,
) {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("DISTRIBUTED_RATE_LIMIT_NOT_CONFIGURED");

  const bucketKey = await stableKey(identity);
  const response = await fetch(`${url}/rest/v1/rpc/consume_api_rate_limit`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_bucket_key: bucketKey,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`DISTRIBUTED_RATE_LIMIT_FAILED:${response.status}`);

  const payload = (await response.json()) as DistributedRateLimitResult[] | DistributedRateLimitResult;
  const result = Array.isArray(payload) ? payload[0] : payload;
  if (!result || typeof result.allowed !== "boolean") throw new Error("DISTRIBUTED_RATE_LIMIT_INVALID_RESPONSE");
  return {
    allowed: result.allowed,
    remaining: Number(result.remaining),
    resetAt: new Date(result.reset_at).getTime(),
  };
}
