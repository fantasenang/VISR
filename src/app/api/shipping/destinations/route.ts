import { NextResponse } from "next/server";
import { searchDomesticDestinations } from "@/lib/shipping/rajaongkir";
import { elapsedMs, logger, requestIdFrom } from "@/lib/observability/logger";

function apiError(requestId: string, code: string, message: string, status: number) {
  return NextResponse.json(
    { error: { code, message }, requestId },
    { status, headers: { "x-request-id": requestId, "Cache-Control": "no-store, max-age=0" } },
  );
}

export async function GET(request: Request) {
  const requestId = requestIdFrom(request);
  const startedAt = performance.now();
  const url = new URL(request.url);
  const search = (url.searchParams.get("search") ?? "").trim();

  if (search.length < 3 || search.length > 80) {
    logger.warn("SHIPPING_DESTINATION_INVALID_QUERY", {
      requestId,
      queryLength: search.length,
      durationMs: elapsedMs(startedAt),
    });
    return apiError(requestId, "INVALID_DESTINATION_QUERY", "Search must contain between 3 and 80 characters.", 400);
  }

  try {
    const destinations = await searchDomesticDestinations(search, 8);
    logger.info("SHIPPING_DESTINATIONS_FOUND", {
      requestId,
      resultCount: destinations.length,
      durationMs: elapsedMs(startedAt),
    });
    return NextResponse.json(
      { destinations, requestId },
      {
        headers: {
          "x-request-id": requestId,
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
        },
      },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "RAJAONGKIR_REQUEST_FAILED";
    const status = code === "RAJAONGKIR_NOT_CONFIGURED" ? 503 : code === "RAJAONGKIR_RATE_LIMITED" ? 429 : 502;
    logger.error("SHIPPING_DESTINATION_LOOKUP_FAILED", {
      requestId,
      code,
      status,
      durationMs: elapsedMs(startedAt),
    });
    return apiError(requestId, code, "Destination lookup is temporarily unavailable.", status);
  }
}
