import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_USERNAME,
  adminSessionCookieOptions,
  createAdminSessionToken,
  createOwnerUser,
  isOwnerConfigured,
  isValidSetupCode,
} from "@/lib/admin/auth";
import { clearAdminAuthAttempts, consumeAdminAuthAttempt } from "@/lib/admin/rate-limit";

const setupSchema = z.object({
  setupCode: z.string().trim().min(12).max(128),
  password: z
    .string()
    .min(12)
    .max(128)
    .regex(/[a-z]/, "Password needs a lowercase letter.")
    .regex(/[A-Z]/, "Password needs an uppercase letter.")
    .regex(/[0-9]/, "Password needs a number."),
});

function rateLimited(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: { code: "ADMIN_SETUP_RATE_LIMITED", message: "Too many setup attempts. Try again later." } },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds), "Cache-Control": "no-store, max-age=0" } },
  );
}

export async function POST(request: Request) {
  const limit = consumeAdminAuthAttempt(request, "setup");
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);

  const body = await request.json().catch(() => null);
  const parsed = setupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_SETUP", message: parsed.error.issues[0]?.message ?? "Check the setup information." } },
      { status: 400 },
    );
  }

  if (!isValidSetupCode(parsed.data.setupCode)) {
    return NextResponse.json(
      { error: { code: "INVALID_SETUP", message: "The VISR Control setup details are not valid." } },
      { status: 403 },
    );
  }

  try {
    if (await isOwnerConfigured()) {
      return NextResponse.json(
        { error: { code: "ADMIN_ALREADY_CONFIGURED", message: "VISR Control has already been activated." } },
        { status: 409 },
      );
    }

    await createOwnerUser(parsed.data.password);
    clearAdminAuthAttempts(request, "setup");
    const { token, session } = createAdminSessionToken();
    const response = NextResponse.json({ ok: true, username: ADMIN_USERNAME }, { status: 201 });
    response.cookies.set(ADMIN_SESSION_COOKIE, token, adminSessionCookieOptions(session.expiresAt));
    response.headers.set("Cache-Control", "no-store, max-age=0");
    response.headers.set("X-Robots-Tag", "noindex");
    return response;
  } catch (error) {
    console.error(JSON.stringify({
      event: "ADMIN_SETUP_FAILED",
      message: error instanceof Error ? error.message : "UNKNOWN_ERROR",
      timestamp: new Date().toISOString(),
    }));
    return NextResponse.json(
      { error: { code: "ADMIN_SETUP_FAILED", message: "VISR Control could not be activated." } },
      { status: 502 },
    );
  }
}
