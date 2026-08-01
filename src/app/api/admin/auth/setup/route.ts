import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: {
        code: "ADMIN_SETUP_MOVED",
        message: "Reload VISR Control and use the native activation form.",
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
