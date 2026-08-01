const CUTOFF_ISO = "2026-08-06T17:00:00.000Z";
const SEQUENCE_CUTOFF_DATE = "2026-08-07";

if (process.env.VERCEL_ENV !== "production") {
  console.log(JSON.stringify({ event: "TRIAL_ORDER_PURGE_SKIPPED", environment: process.env.VERCEL_ENV ?? "local" }));
  process.exit(0);
}

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("TRIAL_ORDER_PURGE_NOT_CONFIGURED");
}

const baseHeaders = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "Content-Type": "application/json",
};

async function request(path, init = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: { ...baseHeaders, ...(init.headers ?? {}) },
    cache: "no-store",
  });

  if (!response.ok) {
    const failure = await response.text().catch(() => "");
    throw new Error(`TRIAL_ORDER_PURGE_REQUEST_FAILED:${response.status}:${path}:${failure}`);
  }

  if (response.status === 204) return null;
  return response.json().catch(() => null);
}

const orderFilter = `created_at=lt.${encodeURIComponent(CUTOFF_ISO)}`;
const trialOrders = (await request(`orders?select=id,order_number,created_at&${orderFilter}`)) ?? [];

if (trialOrders.length > 0) {
  await request(`orders?${orderFilter}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}

const reservations =
  (await request("inventory_reservations?select=product_id,quantity,status&status=in.(active,finalized)")) ?? [];
const products = (await request("products?select=id,stock_total")) ?? [];

const reservedByProduct = new Map();
const soldByProduct = new Map();

for (const reservation of reservations) {
  const quantity = Number(reservation.quantity);
  if (!reservation.product_id || !Number.isFinite(quantity) || quantity <= 0) continue;
  const target = reservation.status === "active" ? reservedByProduct : soldByProduct;
  target.set(reservation.product_id, (target.get(reservation.product_id) ?? 0) + quantity);
}

for (const product of products) {
  const total = Math.max(0, Number(product.stock_total) || 0);
  const sold = Math.min(total, Math.max(0, soldByProduct.get(product.id) ?? 0));
  const reserved = Math.min(Math.max(0, total - sold), Math.max(0, reservedByProduct.get(product.id) ?? 0));

  await request(`products?id=eq.${encodeURIComponent(product.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      stock_reserved: reserved,
      stock_sold: sold,
      updated_at: new Date().toISOString(),
    }),
  });
}

await request(`daily_order_sequences?order_date=lt.${encodeURIComponent(SEQUENCE_CUTOFF_DATE)}`, {
  method: "DELETE",
  headers: { Prefer: "return=minimal" },
});

console.log(
  JSON.stringify({
    event: "TRIAL_ORDER_PURGE_COMPLETE",
    deletedOrders: trialOrders.length,
    reconciledProducts: products.length,
    cutoff: CUTOFF_ISO,
    timestamp: new Date().toISOString(),
  }),
);
