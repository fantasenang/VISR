export type AdminProduct = {
  id: string;
  sku: string;
  name: string;
  variantName: string | null;
  priceIdr: number;
  stockTotal: number;
  stockReserved: number;
  stockSold: number;
  remaining: number;
  maxPerOrder: number;
  isActive: boolean;
  updatedAt: string;
};

export type AdminOrderItem = {
  sku: string;
  name: string;
  variantName: string | null;
  quantity: number;
};

export type AdminOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  email: string;
  whatsapp: string;
  address: string;
  province: string;
  city: string;
  postalCode: string;
  notes: string | null;
  subtotalIdr: number;
  shippingCostIdr: number;
  totalIdr: number;
  paymentStatus: string;
  fulfillmentStatus: string;
  paymentExpiresAt: string;
  paidAt: string | null;
  createdAt: string;
  items: AdminOrderItem[];
  shipment: {
    courier: string | null;
    service: string | null;
    trackingNumber: string | null;
    shippedAt: string | null;
    deliveredAt: string | null;
  } | null;
};

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  variant_name: string | null;
  price_idr: number;
  stock_total: number;
  stock_reserved: number;
  stock_sold: number;
  max_per_order: number;
  is_active: boolean;
  updated_at: string;
};

type OrderRow = {
  id: string;
  order_number: string;
  customer_name: string;
  email: string;
  whatsapp: string;
  address_line: string;
  province: string;
  city: string;
  postal_code: string;
  notes: string | null;
  subtotal_idr: number;
  shipping_cost_idr: number;
  total_idr: number;
  payment_status: string;
  fulfillment_status: string;
  payment_expires_at: string;
  paid_at: string | null;
  created_at: string;
};

type OrderItemRow = {
  order_id: string;
  sku: string;
  product_name: string;
  variant_name: string | null;
  quantity: number;
};

type ShipmentRow = {
  order_id: string;
  courier: string | null;
  service: string | null;
  tracking_number: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
};

function getConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("ADMIN_DATA_NOT_CONFIGURED");
  return { url, serviceRoleKey };
}

function headers(serviceRoleKey: string, extra: Record<string, string> = {}) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function readRows<T>(path: string): Promise<T[]> {
  const { url, serviceRoleKey } = getConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: headers(serviceRoleKey),
    cache: "no-store",
  });
  if (!response.ok) {
    const failure = await response.text().catch(() => "");
    console.error(JSON.stringify({ event: "ADMIN_DATA_READ_FAILED", path, status: response.status, failure }));
    throw new Error("ADMIN_DATA_READ_FAILED");
  }
  return (await response.json()) as T[];
}

async function patchRows<T>(path: string, body: Record<string, unknown>): Promise<T[]> {
  const { url, serviceRoleKey } = getConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method: "PATCH",
    headers: headers(serviceRoleKey, { Prefer: "return=representation" }),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    const failure = await response.text().catch(() => "");
    console.error(JSON.stringify({ event: "ADMIN_DATA_WRITE_FAILED", path, status: response.status, failure }));
    throw new Error("ADMIN_DATA_WRITE_FAILED");
  }
  return (await response.json()) as T[];
}

function groupByOrder<T extends { order_id: string }>(rows: T[]) {
  const grouped = new Map<string, T[]>();
  for (const row of rows) grouped.set(row.order_id, [...(grouped.get(row.order_id) ?? []), row]);
  return grouped;
}

export async function getAdminDashboardData() {
  const [orderRows, productRows] = await Promise.all([
    readRows<OrderRow>(
      "orders?select=id,order_number,customer_name,email,whatsapp,address_line,province,city,postal_code,notes,subtotal_idr,shipping_cost_idr,total_idr,payment_status,fulfillment_status,payment_expires_at,paid_at,created_at&order=created_at.desc&limit=200",
    ),
    readRows<ProductRow>(
      "products?select=id,sku,name,variant_name,price_idr,stock_total,stock_reserved,stock_sold,max_per_order,is_active,updated_at&order=sku.asc",
    ),
  ]);

  const orderIds = orderRows.map((order) => order.id);
  const inFilter = orderIds.length ? `in.(${orderIds.join(",")})` : "eq.00000000-0000-0000-0000-000000000000";
  const [itemRows, shipmentRows] = await Promise.all([
    readRows<OrderItemRow>(
      `order_items?select=order_id,sku,product_name,variant_name,quantity&order_id=${encodeURIComponent(inFilter)}&order=created_at.asc`,
    ),
    readRows<ShipmentRow>(
      `shipments?select=order_id,courier,service,tracking_number,shipped_at,delivered_at&order_id=${encodeURIComponent(inFilter)}`,
    ),
  ]);

  const itemsByOrder = groupByOrder(itemRows);
  const shipmentByOrder = new Map(shipmentRows.map((shipment) => [shipment.order_id, shipment]));

  const orders: AdminOrder[] = orderRows.map((order) => {
    const shipment = shipmentByOrder.get(order.id);
    return {
      id: order.id,
      orderNumber: order.order_number,
      customerName: order.customer_name,
      email: order.email,
      whatsapp: order.whatsapp,
      address: order.address_line,
      province: order.province,
      city: order.city,
      postalCode: order.postal_code,
      notes: order.notes,
      subtotalIdr: order.subtotal_idr,
      shippingCostIdr: order.shipping_cost_idr,
      totalIdr: order.total_idr,
      paymentStatus: order.payment_status,
      fulfillmentStatus: order.fulfillment_status,
      paymentExpiresAt: order.payment_expires_at,
      paidAt: order.paid_at,
      createdAt: order.created_at,
      items: (itemsByOrder.get(order.id) ?? []).map((item) => ({
        sku: item.sku,
        name: item.product_name,
        variantName: item.variant_name,
        quantity: item.quantity,
      })),
      shipment: shipment
        ? {
            courier: shipment.courier,
            service: shipment.service,
            trackingNumber: shipment.tracking_number,
            shippedAt: shipment.shipped_at,
            deliveredAt: shipment.delivered_at,
          }
        : null,
    };
  });

  const products: AdminProduct[] = productRows.map((product) => ({
    id: product.id,
    sku: product.sku,
    name: product.name,
    variantName: product.variant_name,
    priceIdr: product.price_idr,
    stockTotal: product.stock_total,
    stockReserved: product.stock_reserved,
    stockSold: product.stock_sold,
    remaining: Math.max(0, product.stock_total - product.stock_reserved - product.stock_sold),
    maxPerOrder: product.max_per_order,
    isActive: product.is_active,
    updatedAt: product.updated_at,
  }));

  const archivedPaymentStatuses = new Set(["expired", "failed", "refunded"]);
  const activeOrders = orders.filter((order) => !archivedPaymentStatuses.has(order.paymentStatus));
  const paidOrders = orders.filter((order) => order.paymentStatus === "paid");
  const overview = {
    totalOrders: activeOrders.length,
    pendingPayment: orders.filter((order) => order.paymentStatus === "pending").length,
    paidOrders: paidOrders.length,
    needsAction: paidOrders.filter((order) => !["shipped", "delivered"].includes(order.fulfillmentStatus)).length,
    shippedOrders: orders.filter((order) => order.fulfillmentStatus === "shipped").length,
    revenueIdr: paidOrders.reduce((total, order) => total + order.totalIdr, 0),
    lowStockProducts: products.filter((product) => product.isActive && product.remaining <= 5).length,
  };

  return { overview, orders, products };
}

export async function updateAdminOrder(input: {
  id: string;
  fulfillmentStatus: string;
  trackingNumber: string | null;
}) {
  const now = new Date().toISOString();
  const orderRows = await patchRows<OrderRow>(`orders?id=eq.${encodeURIComponent(input.id)}`, {
    fulfillment_status: input.fulfillmentStatus,
    updated_at: now,
  });
  if (!orderRows[0]) throw new Error("ORDER_NOT_FOUND");

  const shipmentUpdate: Record<string, unknown> = {
    tracking_number: input.trackingNumber || null,
    updated_at: now,
  };
  if (input.fulfillmentStatus === "shipped") shipmentUpdate.shipped_at = now;
  if (input.fulfillmentStatus === "delivered") {
    shipmentUpdate.shipped_at = now;
    shipmentUpdate.delivered_at = now;
  }
  await patchRows<ShipmentRow>(`shipments?order_id=eq.${encodeURIComponent(input.id)}`, shipmentUpdate);

  console.info(JSON.stringify({
    event: "ADMIN_ORDER_UPDATED",
    orderId: input.id,
    fulfillmentStatus: input.fulfillmentStatus,
    hasTrackingNumber: Boolean(input.trackingNumber),
    timestamp: now,
  }));

  return orderRows[0];
}

export async function updateAdminProduct(input: {
  sku: string;
  priceIdr: number;
  stockTotal: number;
  maxPerOrder: number;
  isActive: boolean;
}) {
  const currentRows = await readRows<ProductRow>(
    `products?select=id,sku,name,variant_name,price_idr,stock_total,stock_reserved,stock_sold,max_per_order,is_active,updated_at&sku=eq.${encodeURIComponent(input.sku)}&limit=1`,
  );
  const current = currentRows[0];
  if (!current) throw new Error("PRODUCT_NOT_FOUND");
  if (input.stockTotal < current.stock_reserved + current.stock_sold) throw new Error("STOCK_BELOW_COMMITTED");

  const updatedRows = await patchRows<ProductRow>(`products?sku=eq.${encodeURIComponent(input.sku)}`, {
    price_idr: input.priceIdr,
    stock_total: input.stockTotal,
    max_per_order: input.maxPerOrder,
    is_active: input.isActive,
    updated_at: new Date().toISOString(),
  });
  if (!updatedRows[0]) throw new Error("PRODUCT_NOT_FOUND");

  console.info(JSON.stringify({
    event: "ADMIN_PRODUCT_UPDATED",
    sku: input.sku,
    previousPriceIdr: current.price_idr,
    priceIdr: input.priceIdr,
    previousStockTotal: current.stock_total,
    stockTotal: input.stockTotal,
    isActive: input.isActive,
    timestamp: new Date().toISOString(),
  }));

  return updatedRows[0];
}
