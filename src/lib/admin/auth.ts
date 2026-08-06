import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_USERNAME = "malaikatampan";
export const ADMIN_EMAIL = "malaikatampan@icloud.com";
export const ADMIN_SESSION_COOKIE = "visr_control_session";

const SESSION_TTL_SECONDS = 12 * 60 * 60;
const SESSION_VERSION = 2;
const SETUP_CODE_SHA256 = "e4ffd5ddb776beb11b7c83c1328ac1b0f3ad1009c7441e3147a3dcdb43142822";

type AdminSession = {
  version: number;
  username: string;
  email: string;
  role: "owner";
  issuedAt: number;
  mfaVerifiedAt: number;
  expiresAt: number;
};

type SupabaseAuthUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
};

type SupabaseTokenResponse = {
  access_token?: string;
  user?: SupabaseAuthUser;
  error?: string;
  error_description?: string;
  msg?: string;
};

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("ADMIN_AUTH_NOT_CONFIGURED");
  return { url, serviceRoleKey };
}

function getSessionSecret() {
  const configured = process.env.AUTH_SECRET?.trim();
  if (configured) return configured;
  const { serviceRoleKey } = getSupabaseConfig();
  return createHash("sha256").update(`visr-control-v2:${serviceRoleKey}`).digest("hex");
}

function sign(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function isValidSetupCode(value: string) {
  const candidate = createHash("sha256").update(value.trim()).digest("hex");
  return safeEqual(candidate, SETUP_CODE_SHA256);
}

export function createAdminSessionToken(): { token: string; session: AdminSession } {
  const now = Math.floor(Date.now() / 1000);
  const session: AdminSession = {
    version: SESSION_VERSION,
    username: ADMIN_USERNAME,
    email: ADMIN_EMAIL,
    role: "owner",
    issuedAt: now,
    mfaVerifiedAt: now,
    expiresAt: now + SESSION_TTL_SECONDS,
  };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return { token: `${payload}.${sign(payload)}`, session };
}

export function adminSessionCookieOptions(expiresAt?: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: expiresAt ? Math.max(0, expiresAt - Math.floor(Date.now() / 1000)) : SESSION_TTL_SECONDS,
  };
}

export function verifyAdminSessionToken(token: string | undefined): AdminSession | null {
  if (!token) return null;
  const separator = token.lastIndexOf(".");
  if (separator < 1) return null;
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!safeEqual(signature, sign(payload))) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AdminSession;
    const now = Math.floor(Date.now() / 1000);
    if (
      session.version !== SESSION_VERSION ||
      session.expiresAt <= now ||
      !Number.isInteger(session.mfaVerifiedAt) ||
      session.mfaVerifiedAt < session.issuedAt ||
      session.username !== ADMIN_USERNAME ||
      session.email !== ADMIN_EMAIL ||
      session.role !== "owner"
    ) return null;
    return session;
  } catch {
    return null;
  }
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  return verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
}

function authHeaders(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

export async function findOwnerUser(): Promise<SupabaseAuthUser | null> {
  const { url, serviceRoleKey } = getSupabaseConfig();
  const response = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=1000`, {
    headers: authHeaders(serviceRoleKey),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("ADMIN_AUTH_LOOKUP_FAILED");
  const payload = (await response.json()) as { users?: SupabaseAuthUser[] };
  return payload.users?.find((user) => user.email?.toLowerCase() === ADMIN_EMAIL) ?? null;
}

export async function isOwnerConfigured() {
  return Boolean(await findOwnerUser());
}

export async function createOwnerUser(password: string) {
  const existing = await findOwnerUser();
  if (existing) throw new Error("ADMIN_ALREADY_CONFIGURED");

  const { url, serviceRoleKey } = getSupabaseConfig();
  const response = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: authHeaders(serviceRoleKey),
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password,
      email_confirm: true,
      user_metadata: { username: ADMIN_USERNAME, role: "owner" },
      app_metadata: { role: "owner" },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const failure = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error(typeof failure.msg === "string" ? failure.msg : "ADMIN_SETUP_FAILED");
  }

  return (await response.json()) as SupabaseAuthUser;
}

export async function authenticateOwner(username: string, password: string) {
  if (username.trim().toLowerCase() !== ADMIN_USERNAME) return false;
  const { url, serviceRoleKey } = getSupabaseConfig();
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: authHeaders(serviceRoleKey),
    body: JSON.stringify({ email: ADMIN_EMAIL, password }),
    cache: "no-store",
  });

  if (!response.ok) return false;
  const payload = (await response.json()) as SupabaseTokenResponse;
  const user = payload.user;
  if (!payload.access_token || user?.email?.toLowerCase() !== ADMIN_EMAIL) return false;
  const metadataUsername = String(user.user_metadata?.username ?? "").toLowerCase();
  return metadataUsername === ADMIN_USERNAME;
}
