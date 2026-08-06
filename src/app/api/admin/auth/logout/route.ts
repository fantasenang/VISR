import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, adminSessionCookieOptions } from "@/lib/admin/auth";
import {
  ADMIN_CHALLENGE_COOKIE,
  ADMIN_RECOVERY_DISPLAY_COOKIE,
  adminChallengeCookieOptions,
} from "@/lib/admin/two-factor";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", adminSessionCookieOptions(0));
  response.cookies.set(ADMIN_CHALLENGE_COOKIE, "", adminChallengeCookieOptions(0));
  response.cookies.set(ADMIN_RECOVERY_DISPLAY_COOKIE, "", adminChallengeCookieOptions(0));
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
