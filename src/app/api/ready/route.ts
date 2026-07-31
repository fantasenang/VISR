import { NextResponse } from "next/server";
import { elapsedMs, logger, requestIdFrom } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

const REQUIRED_ENVIRONMENT = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "MIDTRANS_SERVER_KEY",
  "RAJAONGKIR_API_KEY",
  "NEXT_PUBLIC_APP_URL",
] as const;

const REQUIRED_DATABASE_OBJECTS = [
  "/orders",
  "/order_items",
  "/rpc/apply_midtrans_notification",
] as const;

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 4_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  const startedAt = performance.now();
  const missingEnvironment = REQUIRED_ENVIRONMENT.filter((name) => !process.env[name]?.trim());
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let database: "ok" | "failed" | "skipped" = "skipped";
  let schema: "ok" | "failed" | "skipped" = "skipped";
  let databaseStatus: number | null = null;
  let schemaStatus: number | null = null;
  let failureReason: string | null = null;

  if (supabaseUrl && serviceRoleKey) {
    const headers = {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: "application/json",
    };

    try {
      const [databaseResponse, schemaResponse] = await Promise.all([
        fetchWithTimeout(`${supabaseUrl}/rest/v1/orders?select=id&limit=1`, { headers }),
        fetchWithTimeout(`${supabaseUrl}/rest/v1/`, {
          headers: { ...headers, Accept: "application/openapi+json" },
        }),
      ]);

      databaseStatus = databaseResponse.status;
      schemaStatus = schemaResponse.status;
      database = databaseResponse.ok ? "ok" : "failed";

      if (schemaResponse.ok) {
        const specification = await schemaResponse.text();
        schema = REQUIRED_DATABASE_OBJECTS.every((objectName) => specification.includes(`\"${objectName}\"`))
          ? "ok"
          : "failed";
      } else {
        schema = "failed";
      }
    } catch (error) {
      database = "failed";
      schema = "failed";
      failureReason = error instanceof Error && error.name === "AbortError" ? "dependency_timeout" : "dependency_unavailable";
    }
  }

  const ready = missingEnvironment.length === 0 && database === "ok" && schema === "ok";
  const durationMs = elapsedMs(startedAt);

  const context = {
    requestId,
    ready,
    database,
    schema,
    databaseStatus,
    schemaStatus,
    missingEnvironment,
    failureReason,
    durationMs,
  };

  if (ready) logger.info("READINESS_CHECK_PASSED", context);
  else logger.warn("READINESS_CHECK_FAILED", context);

  return NextResponse.json(
    {
      status: ready ? "ready" : "not_ready",
      service: "visr-commerce",
      checks: {
        configuration: missingEnvironment.length === 0 ? "ok" : "failed",
        database,
        schema,
      },
      deployment: {
        gitSha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? null,
        gitRef: process.env.VERCEL_GIT_COMMIT_REF ?? null,
        region: process.env.VERCEL_REGION ?? null,
      },
      requestId,
      durationMs,
      timestamp: new Date().toISOString(),
    },
    {
      status: ready ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "x-request-id": requestId,
      },
    },
  );
}
