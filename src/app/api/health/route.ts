import { NextResponse } from "next/server";
import { logger, requestIdFrom } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

const REQUIRED_ENVIRONMENT = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "MIDTRANS_SERVER_KEY",
  "MIDTRANS_CLIENT_KEY",
  "RAJAONGKIR_API_KEY",
] as const;

function shortSha(value?: string) {
  return value?.trim() ? value.trim().slice(0, 12) : null;
}

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  const missing = REQUIRED_ENVIRONMENT.filter((name) => !process.env[name]?.trim());
  const midtransProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
  const healthy = missing.length === 0;
  const deployment = {
    gitSha: shortSha(process.env.VERCEL_GIT_COMMIT_SHA),
    gitRef: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    region: process.env.VERCEL_REGION ?? null,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
  };

  logger.info("HEALTH_CHECK_COMPLETED", {
    requestId,
    healthy,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    paymentMode: midtransProduction ? "production" : "sandbox",
    missingConfigurationCount: missing.length,
    gitSha: deployment.gitSha,
    region: deployment.region,
  });

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      service: "visr-commerce",
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
      paymentMode: midtransProduction ? "production" : "sandbox",
      checks: {
        configuration: healthy ? "ok" : "failed",
      },
      deployment,
      requestId,
      timestamp: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "x-request-id": requestId,
      },
    },
  );
}
