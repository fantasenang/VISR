import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
  authenticateOwner,
} from "@/lib/admin/auth";
import { consumeAdminAuthAttempt } from "@/lib/admin/rate-limit";
import {
  ADMIN_CHALLENGE_COOKIE,
  adminChallengeCookieOptions,
  createAdminChallenge,
  isAdminTotpEnabled,
} from "@/lib/admin/two-factor";
import { consumeDistributedRateLimit } from "@/lib/security/distributed-rate-limit";

const schema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(128),
});

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

  const localLimit = consumeAdminAuthAttempt(request, "login");
  let distributedAllowed = localLimit.allowed;
  try {
    const distributed = await consumeDistributedRateLimit(`owner-password:${address(request)}`, 5, 15 * 60);
    distributedAllowed = distributed.allowed && localLimit.allowed;
  } catch {
    // The local limiter remains a fail-safe if shared storage is temporarily unavailable.
  }
  if (!distributedAllowed) return redirectLogin(request, "rate_limited");

  const formData = await request.formData().catch(() => null);
  const parsed = schema.safeParse({
    username: formData?.get("username"),
    password: formData?.get("password"),
  });
  if (!parsed.success) return redirectLogin(request, "invalid_credentials");

  try {
    const valid = await authenticateOwner(parsed.data.username, parsed.data.password);
    if (!valid) {
      console.warn(JSON.stringify({ event: "ADMIN_PASSWORD_REJECTED", timestamp: new Date().toISOString() }));
      return redirectLogin(request, "invalid_credentials");
    }

    const stage = await isAdminTotpEnabled() ? "verify" : "setup";
    const response = redirectLogin(request);
    response.cookies.set(ADMIN_CHALLENGE_COOKIE, createAdminChallenge(stage), adminChallengeCookieOptions());
    response.cookies.set(ADMIN_SESSION_COOKIE, "", adminSessionCookieOptions(0));
    console.info(JSON.stringify({ event: "ADMIN_PASSWORD_ACCEPTED", stage, timestamp: new Date().toISOString() }));
    return response;
  } catch (error) {
    console.error(JSON.stringify({
      event: "ADMIN_PASSWORD_STAGE_FAILED",
      message: error instanceof Error ? error.message : "UNKNOWN_ERROR",
      timestamp: new Date().toISOString(),
    }));
    return redirectLogin(request, "unavailable");
  }
}
