import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const REQUIRED_ENVIRONMENT = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "MIDTRANS_SERVER_KEY",
  "RAJAONGKIR_API_KEY",
] as const;

export async function GET(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const missing = REQUIRED_ENVIRONMENT.filter((name) => !process.env[name]?.trim());
  const midtransProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
  const healthy = missing.length === 0;
  const gitSha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? null;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      service: "visr-commerce",
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
      paymentMode: midtransProduction ? "production" : "sandbox",
      checks: {
        configuration: healthy ? "ok" : "failed",
      },
      deployment: {
        gitSha,
        gitRef: process.env.VERCEL_GIT_COMMIT_REF ?? null,
        region: process.env.VERCEL_REGION ?? null,
        deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
      },
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
