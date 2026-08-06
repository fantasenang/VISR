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
const cancel = await source("src/app/api/orders/cancel/route.ts");
const config = await source("next.config.ts");
const adminAuth = await source("src/lib/admin/auth.ts");
const twoFactor = await source("src/lib/admin/two-factor.ts");
const qrisAdmin = await source("src/lib/admin/qris.ts");
const qrisSession = await source("src/lib/commerce/qris-manual.ts");
const qrisProofUpload = await source("src/app/api/payments/qris/proof/route.ts");
const proofStorage = await source("src/lib/commerce/qris-payment-proof.ts");
const migration = await source("supabase/migrations/20260806070000_full_security_hardening.sql");

required("64 KB gateway limit", proxy, /MAX_JSON_BODY_BYTES\s*=\s*64\s*\*\s*1024/);
required("origin validation", proxy, /hasValidBrowserOrigin/);
required("distributed rate limiting", proxy, /consumeDistributedRateLimit/);
required("local limiter fallback", proxy, /consumeLocalRateLimit/);
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
required("one-time payment access", snap, /consumePaymentAccess/);
required("multi-provider cancellation lookup", cancel, /select=provider,provider_transaction_id,provider_status/);
required("QRIS claim cancellation guard", cancel, /"claimed"/);
prohibited("Midtrans-only cancellation lookup", cancel, /provider=eq\.midtrans/);
required("MFA session marker", adminAuth, /mfaVerifiedAt/);
required("TOTP verification", twoFactor, /verifyTotp/);
required("encrypted TOTP secret", twoFactor, /aes-256-gcm/);
required("single-use recovery codes", twoFactor, /consume_admin_recovery_code/);
required("random QRIS nonce", qrisSession, /randomBytes\(18\)/);
required("expiring QRIS session", qrisSession, /expiresAt > Date\.now\(\)/);
required("atomic QRIS verification", qrisAdmin, /verify_qris_payment/);
required("proof image sanitization", qrisProofUpload, /sanitizePaymentProofImage/);
required("proof retention timestamp", qrisProofUpload, /delete_after/);
required("proof retention purge", proofStorage, /purgeExpiredQrisPaymentProofs/);
required("database distributed limiter", migration, /consume_api_rate_limit/);
required("database atomic QRIS function", migration, /create or replace function public\.verify_qris_payment/);
required("privileged function revocation", migration, /revoke all on function public\.verify_qris_payment/);
required("enforced CSP", config, /key:\s*"Content-Security-Policy"/);
prohibited("report-only CSP", config, /Content-Security-Policy-Report-Only/);

if (failures.length) {
  console.error("Security regression failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Full VISR security hardening regression passed.");
