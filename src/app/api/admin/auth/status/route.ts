import { NextResponse } from "next/server";
import { ADMIN_EMAIL, ADMIN_USERNAME, getAdminSession, isOwnerConfigured } from "@/lib/admin/auth";

export async function GET() {
  try {
    const [configured, session] = await Promise.all([isOwnerConfigured(), getAdminSession()]);
    return NextResponse.json(
      {
        configured,
        authenticated: Boolean(session),
        owner: { username: ADMIN_USERNAME, recoveryEmail: ADMIN_EMAIL },
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch {
    return NextResponse.json(
      { error: { code: "ADMIN_AUTH_UNAVAILABLE", message: "VISR Control authentication is unavailable." } },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
