import { NextResponse } from "next/server";
import { ADMIN_USERNAME, getAdminSession, isOwnerConfigured } from "@/lib/admin/auth";

export async function GET() {
  try {
    const [configured, session] = await Promise.all([isOwnerConfigured(), getAdminSession()]);
    return NextResponse.json(
      {
        configured,
        authenticated: Boolean(session),
        owner: { username: ADMIN_USERNAME },
      },
      { headers: { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex" } },
    );
  } catch {
    return NextResponse.json(
      { error: { code: "ADMIN_AUTH_UNAVAILABLE", message: "VISR Control authentication is unavailable." } },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex" } },
    );
  }
}
