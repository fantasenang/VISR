import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, adminSessionCookieOptions } from "@/lib/admin/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", adminSessionCookieOptions(0));
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
