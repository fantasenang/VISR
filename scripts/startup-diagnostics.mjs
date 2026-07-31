const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "MIDTRANS_SERVER_KEY", "RAJAONGKIR_API_KEY", "NEXT_PUBLIC_APP_URL"];
const missing = required.filter((name) => !process.env[name]?.trim());
const result = {
  event: missing.length ? "STARTUP_DIAGNOSTICS_FAILED" : "STARTUP_DIAGNOSTICS_PASSED",
  service: "visr-commerce",
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
  paymentMode: process.env.MIDTRANS_IS_PRODUCTION === "true" ? "production" : "sandbox",
  missingEnvironment: missing,
  gitSha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? null,
  timestamp: new Date().toISOString(),
};

console.log(JSON.stringify(result));
if (missing.length) process.exit(1);
