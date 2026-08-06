import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
  createAdminSessionToken,
} from "@/lib/admin/auth";
import { clearAdminAuthAttempts } from "@/lib/admin/rate-limit";
import {
  ADMIN_CHALLENGE_COOKIE,
  ADMIN_RECOVERY_DISPLAY_COOKIE,
  adminChallengeCookieOptions,
  completeTotpEnrollment,
  createRecoveryDisplayToken,
  readAdminChallenge,
  verifyAdminSecondFactor,
} from "@/lib/admin/two-factor";
import { consumeDistributedRateLimit } from "@/lib/security/distributed-rate-limit";

const schema = z.object({ code: z.string().trim().min(6).max(32) });

function cookieValue(request: Request, name: string) {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1 || part.slice(0, separator).trim() !== name) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return "";
}

function address(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "unknown";
}

function redirectLogin(request: Request, error?: string) {
  const target = new URL("/visr-control/login", request.url);
  if (error) target.searchParams.set("error", error);
  const response = NextResponse.redirect(target, 303);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("X-Robots-Tag", "noindex");
  return response;
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== requestUrl.origin) return redirectLogin(request, "invalid_request");

  const challenge = readAdminChallenge(cookieValue(request, ADMIN_CHALLENGE_COOKIE));
  if (!challenge) return redirectLogin(request, "challenge_expired");

  try {
    const limit = await consumeDistributedRateLimit(`owner-second-factor:${address(request)}`, 8, 15 * 60);
    if (!limit.allowed) return redirectLogin(request, "rate_limited");
  } catch {
    // Password-stage limiting remains active if shared storage is temporarily unavailable.
  }

  const formData = await request.formData().catch(() => null);
  const parsed = schema.safeParse({ code: formData?.get("code") });
  if (!parsed.success) return redirectLogin(request, "invalid_code");

  try {
    let recoveryCodes: string[] | null = null;
    const valid = challenge.stage === "setup"
      ? Boolean((recoveryCodes = await completeTotpEnrollment(parsed.data.code)))
      : await verifyAdminSecondFactor(parsed.data.code);
    if (!valid) {
      console.warn(JSON.stringify({ event: "ADMIN_SECOND_FACTOR_REJECTED", timestamp: new Date().toISOString() }));
      return redirectLogin(request, "invalid_code");
    }

    clearAdminAuthAttempts(request, "login");
    const { token, session } = createAdminSessionToken();
    const response = challenge.stage === "setup"
      ? redirectLogin(request)
      : NextResponse.redirect(new URL("/visr-control", request.url), 303);
    response.cookies.set(ADMIN_SESSION_COOKIE, token, adminSessionCookieOptions(session.expiresAt));
    response.cookies.set(ADMIN_CHALLENGE_COOKIE, "", adminChallengeCookieOptions(0));
    if (recoveryCodes) {
      response.cookies.set(
        ADMIN_RECOVERY_DISPLAY_COOKIE,
        createRecoveryDisplayToken(recoveryCodes),
        adminChallengeCookieOptions(),
      );
    }
    response.headers.set("Cache-Control", "no-store, max-age=0");
    console.info(JSON.stringify({
      event: "ADMIN_MFA_LOGIN_SUCCEEDED",
      enrollment: challenge.stage === "setup",
      timestamp: new Date().toISOString(),
    }));
    return response;
  } catch (error) {
    console.error(JSON.stringify({
      event: "ADMIN_SECOND_FACTOR_FAILED",
      message: error instanceof Error ? error.message : "UNKNOWN_ERROR",
      timestamp: new Date().toISOString(),
    }));
    const invalid = error instanceof Error && error.message.includes("INVALID_CODE");
    return redirectLogin(request, invalid ? "invalid_code" : "unavailable");
  }
}
