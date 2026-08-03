import { NextResponse } from "next/server";
import { reconcileInventoryCounters } from "@/lib/commerce/inventory-reconciliation";

const TRACKED_SKUS = [
  "VISR-CARRY-G2",
  "VISR-HALO-CRM",
  "VISR-HALO-ICE",
  "VISR-HALO-EMR",
  "VISR-HALO-AMB",
  "VISR-HALO-PNK",
  "VISR-LINK-ADD",
] as const;

type ProductStockRow = {
  sku: string;
  stock_total: number;
  stock_reserved: number;
  stock_sold: number;
};

export async function GET() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "COMMERCE_NOT_CONFIGURED" }, { status: 503 });
  }

  try {
    await reconcileInventoryCounters({ minimumIntervalMs: 30_000 });
  } catch (error) {
    console.warn(JSON.stringify({
      event: "PUBLIC_STOCK_RECONCILIATION_SKIPPED",
      message: error instanceof Error ? error.message : "UNKNOWN_ERROR",
      timestamp: new Date().toISOString(),
    }));
  }

  const query = new URLSearchParams({
    select: "sku,stock_total,stock_reserved,stock_sold",
    sku: `in.(${TRACKED_SKUS.join(",")})`,
    is_active: "eq.true",
  });

  const response = await fetch(`${supabaseUrl}/rest/v1/products?${query}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.json({ error: "STOCK_LOOKUP_FAILED" }, { status: 502 });
  }

  const rows = (await response.json()) as ProductStockRow[];
  const products = Object.fromEntries(
    rows.map((row) => {
      const remaining = Math.max(0, row.stock_total - row.stock_reserved - row.stock_sold);
      return [
        row.sku,
        {
          total: row.stock_total,
          reserved: row.stock_reserved,
          sold: row.stock_sold,
          remaining,
          soldOut: remaining === 0,
        },
      ];
    }),
  );

  return NextResponse.json(
    { products },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
