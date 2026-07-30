import { NextResponse } from "next/server";

type LookupRequest = {
  orderNumber?: unknown;
  contact?: unknown;
};

type OrderRow = {
  id: string;
  order_number: string;
  batch_code: string;
  customer_name: string;
  email: string;
  whatsapp: string;
  address_line: string;
  province: string;
  city: string;
  postal_code: string;
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
  sku: string;
  product_name: string;
  variant_name: string | null;
  quantity: number;
  unit_price_idr: number;
  line_total_idr: number;
};

type ShipmentRow = {
  courier: string | null;
  service: string | null;
  tracking_number: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
};

function normalizeOrderNumber(value: string) {
  return value.trim().toUpperCase();
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("62")) return digits;
  return digits;
}

function contactMatches(order: OrderRow, contact: string) {
  const normalizedEmail = normalizeEmail(contact);
  const normalizedPhone = normalizePhone(contact);

  return normalizeEmail(order.email) === normalizedEmail || normalizePhone(order.whatsapp) === normalizedPhone;
}

function supabaseHeaders(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as LookupRequest | null;
  const orderNumber = typeof body?.orderNumber === "string" ? normalizeOrderNumber(body.orderNumber) : "";
  const contact = typeof body?.contact === "string" ? body.contact.trim() : "";

  if (!/^VISR\.B\d{2}\.\d{8}\.\d{3,}$/.test(orderNumber) || contact.length < 5 || contact.length > 254) {
    return NextResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "COMMERCE_NOT_CONFIGURED" }, { status: 503 });
  }

  const orderQuery = new URL(`${supabaseUrl}/rest/v1/orders`);
  orderQuery.searchParams.set("select", "id,order_number,batch_code,customer_name,email,whatsapp,address_line,province,city,postal_code,subtotal_idr,shipping_cost_idr,total_idr,payment_status,fulfillment_status,payment_expires_at,paid_at,created_at");
  orderQuery.searchParams.set("order_number", `eq.${orderNumber}`);
  orderQuery.searchParams.set("limit", "1");

  const orderResponse = await fetch(orderQuery, {
    headers: supabaseHeaders(serviceRoleKey),
    cache: "no-store",
  });

  if (!orderResponse.ok) {
    return NextResponse.json({ error: "ORDER_LOOKUP_FAILED" }, { status: 502 });
  }

  const orders = (await orderResponse.json()) as OrderRow[];
  const order = orders[0];

  if (!order || !contactMatches(order, contact)) {
    return NextResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 });
  }

  const itemsQuery = new URL(`${supabaseUrl}/rest/v1/order_items`);
  itemsQuery.searchParams.set("select", "sku,product_name,variant_name,quantity,unit_price_idr,line_total_idr");
  itemsQuery.searchParams.set("order_id", `eq.${order.id}`);
  itemsQuery.searchParams.set("order", "created_at.asc");

  const shipmentQuery = new URL(`${supabaseUrl}/rest/v1/shipments`);
  shipmentQuery.searchParams.set("select", "courier,service,tracking_number,shipped_at,delivered_at");
  shipmentQuery.searchParams.set("order_id", `eq.${order.id}`);
  shipmentQuery.searchParams.set("limit", "1");

  const [itemsResponse, shipmentResponse] = await Promise.all([
    fetch(itemsQuery, { headers: supabaseHeaders(serviceRoleKey), cache: "no-store" }),
    fetch(shipmentQuery, { headers: supabaseHeaders(serviceRoleKey), cache: "no-store" }),
  ]);

  if (!itemsResponse.ok || !shipmentResponse.ok) {
    return NextResponse.json({ error: "ORDER_LOOKUP_FAILED" }, { status: 502 });
  }

  const items = (await itemsResponse.json()) as OrderItemRow[];
  const shipments = (await shipmentResponse.json()) as ShipmentRow[];

  return NextResponse.json(
    {
      order: {
        orderNumber: order.order_number,
        batchCode: order.batch_code,
        customerName: order.customer_name,
        email: order.email,
        whatsapp: order.whatsapp,
        deliveryAddress: {
          address: order.address_line,
          province: order.province,
          city: order.city,
          postalCode: order.postal_code,
        },
        subtotalIdr: order.subtotal_idr,
        shippingCostIdr: order.shipping_cost_idr,
        totalIdr: order.total_idr,
        paymentStatus: order.payment_status,
        fulfillmentStatus: order.fulfillment_status,
        paymentExpiresAt: order.payment_expires_at,
        paidAt: order.paid_at,
        createdAt: order.created_at,
        items: items.map((item) => ({
          sku: item.sku,
          name: item.product_name,
          variant: item.variant_name,
          quantity: item.quantity,
          unitPriceIdr: item.unit_price_idr,
          lineTotalIdr: item.line_total_idr,
        })),
        shipment: shipments[0]
          ? {
              courier: shipments[0].courier,
              service: shipments[0].service,
              trackingNumber: shipments[0].tracking_number,
              shippedAt: shipments[0].shipped_at,
              deliveredAt: shipments[0].delivered_at,
            }
          : null,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
