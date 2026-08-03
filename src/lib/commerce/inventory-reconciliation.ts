type ReservationRow = {
  product_id: string;
  quantity: number;
  status: "active" | "finalized" | "released";
};

type ProductRow = {
  id: string;
  stock_total: number;
  stock_reserved: number;
  stock_sold: number;
};

type ReconciliationResult = {
  checkedProducts: number;
  updatedProducts: number;
};

let lastCompletedAt = 0;
let inFlight: Promise<ReconciliationResult> | null = null;

function getConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("INVENTORY_RECONCILIATION_NOT_CONFIGURED");
  return { url, serviceRoleKey };
}

function headers(serviceRoleKey: string, prefer?: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

async function runReconciliation(): Promise<ReconciliationResult> {
  const { url, serviceRoleKey } = getConfig();
  const [reservationsResponse, productsResponse] = await Promise.all([
    fetch(
      `${url}/rest/v1/inventory_reservations?select=product_id,quantity,status&status=in.(active,finalized)`,
      { headers: headers(serviceRoleKey), cache: "no-store" },
    ),
    fetch(
      `${url}/rest/v1/products?select=id,stock_total,stock_reserved,stock_sold`,
      { headers: headers(serviceRoleKey), cache: "no-store" },
    ),
  ]);

  if (!reservationsResponse.ok || !productsResponse.ok) {
    throw new Error("INVENTORY_RECONCILIATION_READ_FAILED");
  }

  const reservations = (await reservationsResponse.json()) as ReservationRow[];
  const products = (await productsResponse.json()) as ProductRow[];
  const reservedByProduct = new Map<string, number>();
  const soldByProduct = new Map<string, number>();

  for (const reservation of reservations) {
    const quantity = Number(reservation.quantity);
    if (!reservation.product_id || !Number.isFinite(quantity) || quantity <= 0) continue;
    const target = reservation.status === "active" ? reservedByProduct : soldByProduct;
    target.set(
      reservation.product_id,
      (target.get(reservation.product_id) ?? 0) + quantity,
    );
  }

  let updatedProducts = 0;
  for (const product of products) {
    const total = Math.max(0, Number(product.stock_total) || 0);
    const sold = Math.min(total, Math.max(0, soldByProduct.get(product.id) ?? 0));
    const reserved = Math.min(
      Math.max(0, total - sold),
      Math.max(0, reservedByProduct.get(product.id) ?? 0),
    );
    const currentReserved = Math.max(0, Number(product.stock_reserved) || 0);
    const currentSold = Math.max(0, Number(product.stock_sold) || 0);

    if (reserved === currentReserved && sold === currentSold) continue;

    const response = await fetch(
      `${url}/rest/v1/products?id=eq.${encodeURIComponent(product.id)}`,
      {
        method: "PATCH",
        headers: headers(serviceRoleKey, "return=minimal"),
        body: JSON.stringify({
          stock_reserved: reserved,
          stock_sold: sold,
          updated_at: new Date().toISOString(),
        }),
        cache: "no-store",
      },
    );

    if (!response.ok) throw new Error("INVENTORY_RECONCILIATION_UPDATE_FAILED");
    updatedProducts += 1;
  }

  const result = { checkedProducts: products.length, updatedProducts };
  if (updatedProducts > 0) {
    console.info(JSON.stringify({
      event: "INVENTORY_COUNTERS_RECONCILED",
      ...result,
      timestamp: new Date().toISOString(),
    }));
  }
  return result;
}

export async function reconcileInventoryCounters(options: { force?: boolean; minimumIntervalMs?: number } = {}) {
  const minimumIntervalMs = options.minimumIntervalMs ?? 30_000;
  const now = Date.now();
  if (!options.force && now - lastCompletedAt < minimumIntervalMs) {
    return { checkedProducts: 0, updatedProducts: 0 } satisfies ReconciliationResult;
  }
  if (inFlight) return inFlight;

  inFlight = runReconciliation()
    .then((result) => {
      lastCompletedAt = Date.now();
      return result;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}
