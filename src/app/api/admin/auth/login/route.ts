import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
  authenticateOwner,
  createAdminSessionToken,
} from "@/lib/admin/auth";
import { clearAdminAuthAttempts, consumeAdminAuthAttempt } from "@/lib/admin/rate-limit";

const loginSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  const limit = consumeAdminAuthAttempt(request, "login");
  if (!limit.allowed) {
    return NextResponse.json(
      { error: { code: "ADMIN_LOGIN_RATE_LIMITED", message: "Terlalu banyak percobaan login. Coba lagi nanti." } },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds), "Cache-Control": "no-store, max-age=0" } },
    );
  }

  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_CREDENTIALS", message: "Nama akun atau password tidak valid." } },
      { status: 401 },
    );
  }

  try {
    const valid = await authenticateOwner(parsed.data.username, parsed.data.password);
    if (!valid) {
      console.warn(JSON.stringify({ event: "ADMIN_LOGIN_REJECTED", timestamp: new Date().toISOString() }));
      return NextResponse.json(
        { error: { code: "INVALID_CREDENTIALS", message: "Nama akun atau password tidak valid." } },
        { status: 401 },
      );
    }

    clearAdminAuthAttempts(request, "login");
    const { token, session } = createAdminSessionToken();
    const response = NextResponse.json({ ok: true });
    response.cookies.set(ADMIN_SESSION_COOKIE, token, adminSessionCookieOptions(session.expiresAt));
    response.headers.set("Cache-Control", "no-store, max-age=0");
    response.headers.set("X-Robots-Tag", "noindex");
    console.info(JSON.stringify({ event: "ADMIN_LOGIN_SUCCEEDED", timestamp: new Date().toISOString() }));
    return response;
  } catch {
    return NextResponse.json(
      { error: { code: "ADMIN_AUTH_UNAVAILABLE", message: "VISR Control authentication is unavailable." } },
      { status: 503 },
    );
  }
}
