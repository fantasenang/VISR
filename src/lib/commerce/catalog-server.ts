import { haloVariants, products } from "@/lib/commerce/catalog";
import { releaseExpiredVisrReservations } from "@/lib/commerce/reservations";

type ProductRow = {
  sku: string;
  name: string;
  variant_name: string | null;
  price_idr: number;
  stock_total: number;
  stock_reserved: number;
  stock_sold: number;
  max_per_order: number;
  is_active: boolean;
};

function remaining(row: ProductRow | undefined, fallback: number) {
  if (!row) return fallback;
  if (!row.is_active) return 0;
  return Math.max(0, row.stock_total - row.stock_reserved - row.stock_sold);
}

export async function getLiveCatalog() {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let rows: ProductRow[] = [];

  if (supabaseUrl && serviceRoleKey) {
    try {
      await releaseExpiredVisrReservations();
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "CATALOG_RESERVATION_CLEANUP_FAILED",
          message: error instanceof Error ? error.message : "UNKNOWN_ERROR",
          timestamp: new Date().toISOString(),
        }),
      );
    }

    const query = new URLSearchParams({
      select: "sku,name,variant_name,price_idr,stock_total,stock_reserved,stock_sold,max_per_order,is_active",
    });
    const response = await fetch(`${supabaseUrl}/rest/v1/products?${query}`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      cache: "no-store",
    });
    if (response.ok) rows = (await response.json()) as ProductRow[];
  }

  const bySku = new Map(rows.map((row) => [row.sku, row]));
  const carryRow = bySku.get(products.carry.sku);
  const linkRow = bySku.get(products.additionalLink.sku);

  return {
    carry: {
      ...products.carry,
      price: carryRow?.price_idr ?? products.carry.price,
      stock: remaining(carryRow, products.carry.stock),
      maxPerOrder: carryRow?.max_per_order ?? products.carry.maxPerOrder,
      isActive: carryRow?.is_active ?? true,
    },
    halo: {
      ...products.halo,
      variants: haloVariants.map((variant) => {
        const row = bySku.get(variant.sku);
        return {
          ...variant,
          name: row?.variant_name ? `Halo ${row.variant_name}` : variant.name,
          price: row?.price_idr ?? products.halo.price,
          stock: remaining(row, variant.stock),
          maxPerOrder: row?.max_per_order ?? products.halo.maxPerVariant,
          isActive: row?.is_active ?? true,
        };
      }),
    },
    additionalLink: {
      ...products.additionalLink,
      price: linkRow?.price_idr ?? products.additionalLink.price,
      stock: remaining(linkRow, products.additionalLink.stock),
      maxPerOrder: linkRow?.max_per_order ?? products.additionalLink.maxPerOrder,
      isActive: linkRow?.is_active ?? true,
    },
  };
}
