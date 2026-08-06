import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: {
        code: "ADMIN_MFA_LOGIN_REQUIRED",
        message: "Reload VISR Control and use the secure two-factor login.",
      },
    },
    {
      status: 410,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Robots-Tag": "noindex",
      },
    },
  );
}
