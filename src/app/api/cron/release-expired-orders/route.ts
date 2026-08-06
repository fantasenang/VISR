import { NextResponse } from "next/server";
import { purgeExpiredQrisPaymentProofs } from "@/lib/commerce/qris-payment-proof";
import { releaseExpiredVisrReservations } from "@/lib/commerce/reservations";

const CRON_SCHEDULE = "0 0 * * *";

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret) return request.headers.get("authorization") === `Bearer ${cronSecret}`;
  return request.headers.get("x-vercel-cron-schedule") === CRON_SCHEDULE;
}

async function cleanupSecurityState() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("SECURITY_CLEANUP_NOT_CONFIGURED");
  const response = await fetch(`${url}/rest/v1/rpc/cleanup_visr_security_state`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: "{}",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`SECURITY_CLEANUP_FAILED:${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload) ? payload[0] : payload;
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
    const [proofs, security] = await Promise.allSettled([
      purgeExpiredQrisPaymentProofs(),
      cleanupSecurityState(),
    ]);
    if (proofs.status === "rejected") {
      console.error(JSON.stringify({
        event: "QRIS_PROOF_RETENTION_CRON_FAILED",
        message: proofs.reason instanceof Error ? proofs.reason.message : "UNKNOWN_ERROR",
      }));
    }
    if (security.status === "rejected") {
      console.error(JSON.stringify({
        event: "SECURITY_STATE_CLEANUP_CRON_FAILED",
        message: security.reason instanceof Error ? security.reason.message : "UNKNOWN_ERROR",
      }));
    }
    return NextResponse.json(
      {
        ok: true,
        releasedReservations,
        deletedPaymentProofs: proofs.status === "fulfilled" ? proofs.value : null,
        securityCleanup: security.status === "fulfilled" ? security.value : null,
        ranAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex" } },
    );
  } catch (error) {
    console.error(JSON.stringify({
      event: "ORDER_EXPIRY_CRON_FAILED",
      message: error instanceof Error ? error.message : "UNKNOWN_ERROR",
      timestamp: new Date().toISOString(),
    }));
    return NextResponse.json(
      { error: { code: "ORDER_EXPIRY_CRON_FAILED", message: "Scheduled maintenance could not be completed." } },
      { status: 502, headers: { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex" } },
    );
  }
}
