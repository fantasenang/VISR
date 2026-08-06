import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { ADMIN_EMAIL, ADMIN_USERNAME } from "@/lib/admin/auth";

export const ADMIN_CHALLENGE_COOKIE = "visr_control_challenge";
export const ADMIN_RECOVERY_DISPLAY_COOKIE = "visr_control_recovery";
const CHALLENGE_TTL_SECONDS = 10 * 60;
const ENROLLMENT_TTL_MS = 30 * 60 * 1000;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

type SecurityRow = {
  owner_email: string;
  totp_secret_ciphertext: string | null;
  pending_totp_secret_ciphertext: string | null;
  pending_totp_created_at: string | null;
  totp_enabled_at: string | null;
  recovery_code_hashes: string[];
};

type Challenge = {
  username: string;
  stage: "setup" | "verify";
  issuedAt: number;
  expiresAt: number;
};

type RecoveryDisplay = {
  codes: string[];
  expiresAt: number;
};

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("ADMIN_2FA_NOT_CONFIGURED");
  return { url, serviceRoleKey };
}

function databaseHeaders(serviceRoleKey: string, prefer?: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

function rootSecret() {
  const configured = process.env.AUTH_SECRET?.trim();
  if (configured) return configured;
  return `visr-owner-2fa:${config().serviceRoleKey}`;
}

function encryptionKey() {
  return createHash("sha256").update(`encryption:${rootSecret()}`).digest();
}

function signingKey() {
  return createHash("sha256").update(`signing:${rootSecret()}`).digest();
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

function decrypt(value: string) {
  const parts = value.split(".");
  if (parts.length !== 3) throw new Error("INVALID_ENCRYPTED_SECRET");
  const [iv, tag, encrypted] = parts.map((part) => Buffer.from(part, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

function sign(payload: string) {
  return createHmac("sha256", signingKey()).update(payload).digest("base64url");
}

function signedToken(value: unknown) {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function parseSignedToken<T>(token: string | undefined): T | null {
  if (!token) return null;
  const separator = token.lastIndexOf(".");
  if (separator < 1) return null;
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!safeEqual(signature, sign(payload))) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

function base32Encode(bytes: Uint8Array) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(input: string) {
  const normalized = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) throw new Error("INVALID_BASE32");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

function totpAt(secret: string, counter: number) {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

export function verifyTotp(secret: string, code: string) {
  const normalized = code.replace(/\D/g, "");
  if (normalized.length !== 6) return false;
  const counter = Math.floor(Date.now() / 1000 / 30);
  return [-1, 0, 1].some((offset) => safeEqual(totpAt(secret, counter + offset), normalized));
}

async function readSecurityRow() {
  const { url, serviceRoleKey } = config();
  const response = await fetch(
    `${url}/rest/v1/admin_security?select=owner_email,totp_secret_ciphertext,pending_totp_secret_ciphertext,pending_totp_created_at,totp_enabled_at,recovery_code_hashes&owner_email=eq.${encodeURIComponent(ADMIN_EMAIL)}&limit=1`,
    { headers: databaseHeaders(serviceRoleKey), cache: "no-store" },
  );
  if (!response.ok) throw new Error("ADMIN_2FA_READ_FAILED");
  return ((await response.json()) as SecurityRow[])[0] ?? null;
}

async function writeSecurityRow(body: Record<string, unknown>) {
  const { url, serviceRoleKey } = config();
  const response = await fetch(`${url}/rest/v1/admin_security?on_conflict=owner_email`, {
    method: "POST",
    headers: databaseHeaders(serviceRoleKey, "resolution=merge-duplicates,return=minimal"),
    body: JSON.stringify({ owner_email: ADMIN_EMAIL, ...body, updated_at: new Date().toISOString() }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("ADMIN_2FA_WRITE_FAILED");
}

export async function isAdminTotpEnabled() {
  const row = await readSecurityRow();
  return Boolean(row?.totp_secret_ciphertext && row.totp_enabled_at);
}

export async function ensureTotpEnrollment() {
  const row = await readSecurityRow();
  if (row?.totp_secret_ciphertext && row.totp_enabled_at) throw new Error("ADMIN_2FA_ALREADY_ENABLED");
  const pendingIsFresh = Boolean(
    row?.pending_totp_secret_ciphertext
      && row.pending_totp_created_at
      && Date.now() - new Date(row.pending_totp_created_at).getTime() < ENROLLMENT_TTL_MS,
  );
  const secret = pendingIsFresh
    ? decrypt(row!.pending_totp_secret_ciphertext!)
    : base32Encode(randomBytes(20));
  if (!pendingIsFresh) {
    await writeSecurityRow({
      pending_totp_secret_ciphertext: encrypt(secret),
      pending_totp_created_at: new Date().toISOString(),
    });
  }
  return {
    secret,
    uri: `otpauth://totp/${encodeURIComponent(`VISR:${ADMIN_EMAIL}`)}?secret=${secret}&issuer=${encodeURIComponent("VISR")}&algorithm=SHA1&digits=6&period=30`,
  };
}

function normalizeRecoveryCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function recoveryHash(value: string) {
  return createHash("sha256").update(normalizeRecoveryCode(value)).digest("hex");
}

function generateRecoveryCodes() {
  return Array.from({ length: 10 }, () => {
    const raw = randomBytes(8).toString("hex").toUpperCase();
    return `VISR-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
  });
}

export async function completeTotpEnrollment(code: string) {
  const row = await readSecurityRow();
  if (!row?.pending_totp_secret_ciphertext || !row.pending_totp_created_at) {
    throw new Error("ADMIN_2FA_ENROLLMENT_MISSING");
  }
  if (Date.now() - new Date(row.pending_totp_created_at).getTime() > ENROLLMENT_TTL_MS) {
    throw new Error("ADMIN_2FA_ENROLLMENT_EXPIRED");
  }
  const secret = decrypt(row.pending_totp_secret_ciphertext);
  if (!verifyTotp(secret, code)) throw new Error("ADMIN_2FA_INVALID_CODE");
  const recoveryCodes = generateRecoveryCodes();
  await writeSecurityRow({
    totp_secret_ciphertext: encrypt(secret),
    totp_enabled_at: new Date().toISOString(),
    pending_totp_secret_ciphertext: null,
    pending_totp_created_at: null,
    recovery_code_hashes: recoveryCodes.map(recoveryHash),
  });
  return recoveryCodes;
}

async function consumeRecoveryCode(code: string) {
  const { url, serviceRoleKey } = config();
  const response = await fetch(`${url}/rest/v1/rpc/consume_admin_recovery_code`, {
    method: "POST",
    headers: databaseHeaders(serviceRoleKey),
    body: JSON.stringify({ p_owner_email: ADMIN_EMAIL, p_code_hash: recoveryHash(code) }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("ADMIN_RECOVERY_CODE_CHECK_FAILED");
  return Boolean(await response.json());
}

export async function verifyAdminSecondFactor(code: string) {
  const normalizedDigits = code.replace(/\D/g, "");
  if (normalizedDigits.length === 6) {
    const row = await readSecurityRow();
    if (!row?.totp_secret_ciphertext || !row.totp_enabled_at) return false;
    return verifyTotp(decrypt(row.totp_secret_ciphertext), normalizedDigits);
  }
  return consumeRecoveryCode(code);
}

export function createAdminChallenge(stage: Challenge["stage"]) {
  const now = Math.floor(Date.now() / 1000);
  return signedToken({
    username: ADMIN_USERNAME,
    stage,
    issuedAt: now,
    expiresAt: now + CHALLENGE_TTL_SECONDS,
  } satisfies Challenge);
}

export function readAdminChallenge(token: string | undefined) {
  const challenge = parseSignedToken<Challenge>(token);
  if (!challenge || challenge.expiresAt <= Math.floor(Date.now() / 1000)) return null;
  if (challenge.username !== ADMIN_USERNAME || !["setup", "verify"].includes(challenge.stage)) return null;
  return challenge;
}

export function createRecoveryDisplayToken(codes: string[]) {
  return signedToken({ codes, expiresAt: Math.floor(Date.now() / 1000) + CHALLENGE_TTL_SECONDS } satisfies RecoveryDisplay);
}

export function readRecoveryDisplayToken(token: string | undefined) {
  const payload = parseSignedToken<RecoveryDisplay>(token);
  if (!payload || payload.expiresAt <= Math.floor(Date.now() / 1000) || !Array.isArray(payload.codes)) return null;
  return payload.codes;
}

export function adminChallengeCookieOptions(maxAge = CHALLENGE_TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/visr-control",
    maxAge,
  };
}
