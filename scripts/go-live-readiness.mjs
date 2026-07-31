const required = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "MIDTRANS_SERVER_KEY",
  "RAJAONGKIR_API_KEY",
  "NEXT_PUBLIC_APP_URL",
];

const failures = [];
const warnings = [];
const results = [];

function pass(name, detail) {
  results.push({ name, status: "PASS", detail });
}

function fail(name, detail) {
  results.push({ name, status: "FAIL", detail });
  failures.push(`${name}: ${detail}`);
}

function warn(name, detail) {
  results.push({ name, status: "WARN", detail });
  warnings.push(`${name}: ${detail}`);
}

const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) fail("Environment", `Missing ${missing.join(", ")}`);
else pass("Environment", "Required variables are present");

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
let baseUrl = null;
if (appUrl) {
  try {
    const parsed = new URL(appUrl);
    baseUrl = parsed.origin;
    if (parsed.protocol !== "https:") fail("HTTPS", "NEXT_PUBLIC_APP_URL must use HTTPS");
    else pass("HTTPS", parsed.origin);

    if (![/^visr\.works$/i, /^www\.visr\.works$/i].some((pattern) => pattern.test(parsed.hostname))) {
      warn("Domain", `Configured host is ${parsed.hostname}`);
    } else {
      pass("Domain", parsed.hostname);
    }
  } catch {
    fail("Application URL", "NEXT_PUBLIC_APP_URL is invalid");
  }
}

if (process.env.MIDTRANS_IS_PRODUCTION === "true") pass("Payment mode", "Midtrans production");
else warn("Payment mode", "Midtrans sandbox mode is active");

if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
  warn("Vercel environment", process.env.VERCEL_ENV);
} else if (process.env.VERCEL_ENV === "production") {
  pass("Vercel environment", "production");
}

async function remoteCheck(name, path, validator) {
  if (!baseUrl) return;
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { Accept: "application/json" },
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    const body = await response.json().catch(() => null);
    if (response.ok && validator(body)) pass(name, `${response.status} ${path}`);
    else fail(name, `${response.status} ${path}`);
  } catch (error) {
    fail(name, error instanceof Error ? error.message : "request failed");
  }
}

if (process.env.GO_LIVE_REMOTE_CHECKS !== "false") {
  await remoteCheck("Health", "/api/health", (body) => body?.status === "ok");
  await remoteCheck("Readiness", "/api/ready", (body) => body?.status === "ready");
}

for (const result of results) {
  console.log(`${result.status.padEnd(4)} ${result.name} — ${result.detail}`);
}

if (failures.length) {
  console.error(`\nNOT READY — ${failures.length} blocking issue(s).`);
  process.exit(1);
}

if (warnings.length) console.warn(`\nREADY WITH ${warnings.length} WARNING(S)`);
else console.log("\nREADY FOR PREORDER");
