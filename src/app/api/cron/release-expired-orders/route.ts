import { NextResponse } from "next/server";
import { releaseExpiredVisrReservations } from "@/lib/commerce/reservations";

const CRON_SCHEDULE = "0 0 * * *";

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret) return request.headers.get("authorization") === `Bearer ${cronSecret}`;
  return request.headers.get("x-vercel-cron-schedule") === CRON_SCHEDULE;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: { code: "CRON_UNAUTHORIZED", message: "Unauthorized." } },
      { status: 401, headers: { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex" } },
    );
  }

  try {
    const releasedReservations = await releaseExpiredVisrReservations();
    return NextResponse.json(
      { ok: true, releasedReservations, ranAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex" } },
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "ORDER_EXPIRY_CRON_FAILED",
        message: error instanceof Error ? error.message : "UNKNOWN_ERROR",
        timestamp: new Date().toISOString(),
      }),
    );
    return NextResponse.json(
      { error: { code: "ORDER_EXPIRY_CRON_FAILED", message: "Expired reservations could not be released." } },
      { status: 502, headers: { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex" } },
    );
  }
}
