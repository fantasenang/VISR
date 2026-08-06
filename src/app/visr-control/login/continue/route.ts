import { NextResponse } from "next/server";
import {
  ADMIN_RECOVERY_DISPLAY_COOKIE,
  adminChallengeCookieOptions,
} from "@/lib/admin/two-factor";

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== requestUrl.origin) {
    return NextResponse.redirect(new URL("/visr-control/login?error=invalid_request", request.url), 303);
  }
  const response = NextResponse.redirect(new URL("/visr-control", request.url), 303);
  response.cookies.set(ADMIN_RECOVERY_DISPLAY_COOKIE, "", adminChallengeCookieOptions(0));
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
