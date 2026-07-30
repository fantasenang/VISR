import { NextResponse } from "next/server";
import { z } from "zod";

const requestSchema = z.object({
  orderId: z.string().uuid(),
});

type OrderRow = {
  id: string;
  order_number: string;
  customer_name: string;
  email: string;
  whatsapp: string;
  subtotal_idr: number;
  shipping_cost_idr: number;
  total_idr: number;
  payment_status: string;
  payment_expires_at: string;
};

type ItemRow = {
  sku: string;
  product_name: string;
  variant_name: string | null;
  quantity: number;
  unit_price_idr: number;
};

type MidtransSnapResponse = {
  token?: string;
  redirect_url?: string;
  status_code?: string;
  status_message?: string;
  error_messages?: string[];
};

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_PAYMENT_REQUEST" }, { status: 400 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";

  if (!supabaseUrl || !serviceRoleKey || !serverKey) {
    console.error("MIDTRANS_CONFIGURATION_ERROR", {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceRoleKey: Boolean(serviceRoleKey),
      hasServerKey: Boolean(serverKey),
      isProduction,
    });
    return NextResponse.json(
      { error: "Payment service is not configured yet. Your reservation remains active." },
      { status: 503 },
    );
  }

  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };

  const [orderResponse, itemsResponse] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${parsed.data.orderId}&select=*`, { headers, cache: "no-store" }),
    fetch(`${supabaseUrl}/rest/v1/order_items?order_id=eq.${parsed.data.orderId}&select=sku,product_name,variant_name,quantity,unit_price_idr`, { headers, cache: "no-store" }),
  ]);

  if (!orderResponse.ok || !itemsResponse.ok) {
    console.error("MIDTRANS_ORDER_LOOKUP_ERROR", {
      orderStatus: orderResponse.status,
      itemsStatus: itemsResponse.status,
    });
    return NextResponse.json(
      { error: "We could not prepare your payment. Your reservation remains active." },
      { status: 502 },
    );
  }

  const orders = (await orderResponse.json()) as OrderRow[];
  const items = (await itemsResponse.json()) as ItemRow[];
  const order = orders[0];

  if (!order) return NextResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 });
  if (order.payment_status !== "pending") return NextResponse.json({ error: "ORDER_NOT_PAYABLE" }, { status: 409 });
  if (new Date(order.payment_expires_at).getTime() <= Date.now()) return NextResponse.json({ error: "ORDER_EXPIRED" }, { status: 409 });

  const grossAmount = order.total_idr;
  const itemDetails = items.map((item) => ({
    id: item.sku,
    price: item.unit_price_idr,
    quantity: item.quantity,
    name: item.variant_name ? `${item.product_name} — ${item.variant_name}` : item.product_name,
  }));

  if (order.shipping_cost_idr > 0) {
    itemDetails.push({ id: "SHIPPING", price: order.shipping_cost_idr, quantity: 1, name: "Shipping" });
  }

  const endpoint = isProduction
    ? "https://app.midtrans.com/snap/v1/transactions"
    : "https://app.sandbox.midtrans.com/snap/v1/transactions";

  const midtransResponse = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      transaction_details: {
        order_id: order.order_number,
        gross_amount: grossAmount,
      },
      item_details: itemDetails,
      customer_details: {
        first_name: order.customer_name,
        email: order.email,
        phone: order.whatsapp,
      },
      expiry: {
        unit: "hour",
        duration: 24,
      },
      callbacks: {
        finish: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/checkout?payment=finish`,
        error: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/checkout?payment=error`,
        pending: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/checkout?payment=pending`,
      },
    }),
    cache: "no-store",
  });

  const raw = await midtransResponse.text();
  let payload: MidtransSnapResponse = {};
  try {
    payload = raw ? (JSON.parse(raw) as MidtransSnapResponse) : {};
  } catch {
    payload = {};
  }

  if (!midtransResponse.ok || !payload.token) {
    console.error("MIDTRANS_API_ERROR", {
      environment: isProduction ? "production" : "sandbox",
      status: midtransResponse.status,
      statusText: midtransResponse.statusText,
      orderNumber: order.order_number,
      grossAmount,
      response: raw.slice(0, 2000),
    });

    return NextResponse.json(
      {
        error: "Payment service is temporarily unavailable. Your reservation remains active. Please try again in a few minutes.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ token: payload.token, redirectUrl: payload.redirect_url });
}
