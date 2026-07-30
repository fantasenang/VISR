import { NextResponse } from "next/server";
import { searchDomesticDestinations } from "@/lib/shipping/rajaongkir";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const search = (url.searchParams.get("search") ?? "").trim();

  if (search.length < 3 || search.length > 80) {
    return NextResponse.json({ destinations: [] });
  }

  try {
    const destinations = await searchDomesticDestinations(search, 8);
    return NextResponse.json(
      { destinations },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "RAJAONGKIR_REQUEST_FAILED";
    const status = message === "RAJAONGKIR_NOT_CONFIGURED" ? 503 : message === "RAJAONGKIR_RATE_LIMITED" ? 429 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
