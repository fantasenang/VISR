const isProduction = process.env.VERCEL_ENV === "production";

if (!isProduction) {
  console.log("VISR Carry database rename skipped outside production.");
  process.exit(0);
}

const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error("VISR_CARRY_RENAME_NOT_CONFIGURED");
}

const headers = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function patch(path, body) {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`VISR_CARRY_RENAME_FAILED:${response.status}:${text}`);
  }

  return text ? JSON.parse(text) : [];
}

const products = await patch(
  "products?sku=eq.VISR-CARRY-G2",
  { name: "VISR Carry" },
);

const orderItems = await patch(
  "order_items?sku=eq.VISR-CARRY-G2",
  { product_name: "VISR Carry" },
);

console.log(
  JSON.stringify({
    event: "VISR_CARRY_RENAMED",
    productsUpdated: Array.isArray(products) ? products.length : 0,
    orderItemsUpdated: Array.isArray(orderItems) ? orderItems.length : 0,
  }),
);
