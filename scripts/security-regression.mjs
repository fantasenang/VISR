import { readFile } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];

async function source(path) {
  return readFile(join(root, path), "utf8");
}

function required(label, content, pattern) {
  if (!pattern.test(content)) failures.push(`${label} is missing`);
}

function prohibited(label, content, pattern) {
  if (pattern.test(content)) failures.push(`${label} is still present`);
}

const proxy = await source("src/proxy.ts");
const api = await source("src/lib/http/api.ts");
const logger = await source("src/lib/observability/logger.ts");
const schema = await source("src/lib/commerce/order-schema.ts");
const input = await source("src/lib/security/input.ts");
const webhook = await source("src/app/api/payments/midtrans/webhook/route.ts");
const snap = await source("src/app/api/payments/snap/route.ts");
const config = await source("next.config.ts");

required("64 KB gateway limit", proxy, /MAX_JSON_BODY_BYTES\s*=\s*64\s*\*\s*1024/);
required("origin validation", proxy, /hasValidBrowserOrigin/);
required("rate limiting", proxy, /consumeRateLimit/);
required("bounded stream parser", api, /getReader\(\)/);
required("strict UTF-8 parser", api, /fatal:\s*true/);
required("public error filtering", api, /SENSITIVE_ERROR_PATTERN/);
required("structured-log redaction", logger, /SECRET_VALUE_PATTERNS/);
required("request-ID validation", logger, /REQUEST_ID_PATTERN/);
required("schema-bound sanitization", schema, /sanitizePlainText/);
required("Unicode normalization", input, /normalize\("NFKC"\)/);
required("control-character removal", input, /CONTROL_CHARACTERS/);
required("zero-width-character removal", input, /ZERO_WIDTH_CHARACTERS/);
required("bidi-override removal", input, /BIDI_OVERRIDE_CHARACTERS/);
required("HTML angle-bracket removal", input, /ANGLE_BRACKETS/);
required("constant-time signature verification", webhook, /timingSafeEqual/);
required("payment amount validation", webhook, /AMOUNT_MISMATCH/);
required("database webhook idempotency", webhook, /apply_midtrans_notification/);
required("payable-state validation", snap, /payment_status\s*!==\s*"pending"/);
required("payment expiry validation", snap, /payment_expires_at/);
required("enforced CSP", config, /key:\s*"Content-Security-Policy"/);
prohibited("report-only CSP", config, /Content-Security-Policy-Report-Only/);

if (failures.length) {
  console.error("Security regression failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Phase 3 security regression passed.");
