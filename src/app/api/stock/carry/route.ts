import { NextResponse } from "next/server";
import { products } from "@/lib/commerce/catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "COMMERCE_NOT_CONFIGURED" }, { status: 503 });
  }

  const url = new URL(`${supabaseUrl}/rest/v1/products`);
  url.searchParams.set("select", "stock_total,stock_reserved,stock_sold");
  url.searchParams.set("sku", `eq.${products.carry.sku}`);
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.json({ error: "STOCK_UNAVAILABLE" }, { status: 502 });
  }

  const rows = (await response.json()) as Array<{
    stock_total: number;
    stock_reserved: number;
    stock_sold: number;
  }>;
  const stock = rows[0];

  if (!stock) {
    return NextResponse.json({ error: "PRODUCT_NOT_FOUND" }, { status: 404 });
  }

  const total = Math.max(0, stock.stock_total);
  const reserved = Math.max(0, stock.stock_reserved);
  const sold = Math.max(0, stock.stock_sold);
  const remaining = Math.max(0, total - reserved - sold);

  return NextResponse.json(
    { total, reserved, sold, remaining, soldOut: remaining === 0 },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
