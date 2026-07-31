const required = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "MIDTRANS_SERVER_KEY",
  "RAJAONGKIR_API_KEY",
  "NEXT_PUBLIC_APP_URL",
];

const failures = [];
const warnings = [];

for (const name of required) {
  if (!process.env[name]?.trim()) failures.push(`${name} is missing`);
}

const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
if (appUrl) {
  try {
    const parsed = new URL(appUrl);
    if (parsed.protocol !== "https:") failures.push("NEXT_PUBLIC_APP_URL must use HTTPS");
    if (![/^visr\.works$/i, /^www\.visr\.works$/i].some((pattern) => pattern.test(parsed.hostname))) {
      warnings.push(`NEXT_PUBLIC_APP_URL points to ${parsed.hostname}, not the primary VISR domain`);
    }
  } catch {
    failures.push("NEXT_PUBLIC_APP_URL is not a valid URL");
  }
}

if (process.env.MIDTRANS_IS_PRODUCTION !== "true") {
  warnings.push("MIDTRANS_IS_PRODUCTION is not true; payments remain in sandbox mode");
}

if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
  warnings.push(`VERCEL_ENV is ${process.env.VERCEL_ENV}, not production`);
}

const maskedChecks = {
  supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
  midtrans: Boolean(process.env.MIDTRANS_SERVER_KEY),
  rajaongkir: Boolean(process.env.RAJAONGKIR_API_KEY),
  appUrl: appUrl ?? null,
  paymentMode: process.env.MIDTRANS_IS_PRODUCTION === "true" ? "production" : "sandbox",
};

console.log(JSON.stringify({ checks: maskedChecks, warnings, failures }, null, 2));

if (failures.length) {
  console.error(`Go-live readiness failed with ${failures.length} blocking issue(s).`);
  process.exit(1);
}

if (warnings.length) {
  console.warn(`Go-live readiness passed with ${warnings.length} warning(s).`);
} else {
  console.log("Go-live readiness passed without warnings.");
}
