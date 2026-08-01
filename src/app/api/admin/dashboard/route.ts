import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";
import { getAdminDashboardData } from "@/lib/admin/data";
import { releaseExpiredVisrReservations } from "@/lib/commerce/reservations";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json(
      { error: { code: "ADMIN_UNAUTHORIZED", message: "Sign in to VISR Control." } },
      { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }

  try {
    try {
      await releaseExpiredVisrReservations();
    } catch (cleanupError) {
      console.warn(JSON.stringify({
        event: "ADMIN_RESERVATION_CLEANUP_SKIPPED",
        message: cleanupError instanceof Error ? cleanupError.message : "UNKNOWN_ERROR",
        timestamp: new Date().toISOString(),
      }));
    }

    const data = await getAdminDashboardData();
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error(JSON.stringify({
      event: "ADMIN_DASHBOARD_FAILED",
      message: error instanceof Error ? error.message : "UNKNOWN_ERROR",
      timestamp: new Date().toISOString(),
    }));
    return NextResponse.json(
      { error: { code: "ADMIN_DASHBOARD_FAILED", message: "Dashboard data could not be loaded." } },
      { status: 502, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
