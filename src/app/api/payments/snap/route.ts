import { NextResponse } from "next/server";
import { z } from "zod";
import { elapsedMs, logger, requestIdFrom } from "@/lib/observability/logger";

const requestSchema = z.object({ orderId: z.string().uuid() });

type OrderRow = { id: string; order_number: string; customer_name: string; email: string; whatsapp: string; subtotal_idr: number; shipping_cost_idr: number; total_idr: number; payment_status: string; payment_expires_at: string };
type ItemRow = { sku: string; product_name: string; variant_name: string | null; quantity: number; unit_price_idr: number };
type MidtransSnapResponse = { token?: string; redirect_url?: string; status_code?: string; status_message?: string; error_messages?: string[] };
type SnapResult = { status: number; body: Record<string, unknown> };
type CachedSnap = { expiresAt: number; promise: Promise<SnapResult> };

const SNAP_CACHE_TTL_MS = 15 * 60 * 1000;
const snapCache = new Map<string, CachedSnap>();

function pruneSnapCache(now: number) {
  for (const [key, entry] of snapCache) if (entry.expiresAt <= now) snapCache.delete(key);
}

async function createSnapToken(orderId: string, requestId: string): Promise<SnapResult> {
  const startedAt = performance.now();
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";

  if (!supabaseUrl || !serviceRoleKey || !serverKey) {
    logger.error("MIDTRANS_CONFIGURATION_ERROR", { requestId, orderId, hasSupabaseUrl: Boolean(supabaseUrl), hasServiceRoleKey: Boolean(serviceRoleKey), hasServerKey: Boolean(serverKey), environment: isProduction ? "production" : "sandbox" });
    return { status: 503, body: { error: "Payment service is not configured yet. Your reservation remains active." } };
  }

  const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  const lookupStartedAt = performance.now();
  const [orderResponse, itemsResponse] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${orderId}&select=*`, { headers, cache: "no-store" }),
    fetch(`${supabaseUrl}/rest/v1/order_items?order_id=eq.${orderId}&select=sku,product_name,variant_name,quantity,unit_price_idr`, { headers, cache: "no-store" }),
  ]);

  if (!orderResponse.ok || !itemsResponse.ok) {
    logger.error("MIDTRANS_ORDER_LOOKUP_ERROR", { requestId, orderId, orderStatus: orderResponse.status, itemsStatus: itemsResponse.status, durationMs: elapsedMs(lookupStartedAt) });
    return { status: 502, body: { error: "We could not prepare your payment. Your reservation remains active." } };
  }

  const orders = (await orderResponse.json()) as OrderRow[];
  const items = (await itemsResponse.json()) as ItemRow[];
  const order = orders[0];
  if (!order) return { status: 404, body: { error: "ORDER_NOT_FOUND" } };
  if (order.payment_status !== "pending") return { status: 409, body: { error: "ORDER_NOT_PAYABLE" } };
  if (new Date(order.payment_expires_at).getTime() <= Date.now()) return { status: 409, body: { error: "ORDER_EXPIRED" } };

  const grossAmount = order.total_idr;
  const itemDetails = items.map((item) => ({ id: item.sku, price: item.unit_price_idr, quantity: item.quantity, name: item.variant_name ? `${item.product_name} — ${item.variant_name}` : item.product_name }));
  if (order.shipping_cost_idr > 0) itemDetails.push({ id: "SHIPPING", price: order.shipping_cost_idr, quantity: 1, name: "Shipping" });

  const endpoint = isProduction ? "https://app.midtrans.com/snap/v1/transactions" : "https://app.sandbox.midtrans.com/snap/v1/transactions";
  const providerStartedAt = performance.now();
  const midtransResponse = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      transaction_details: { order_id: order.order_number, gross_amount: grossAmount },
      item_details: itemDetails,
      customer_details: { first_name: order.customer_name, email: order.email, phone: order.whatsapp },
      expiry: { unit: "hour", duration: 24 },
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
  try { payload = raw ? (JSON.parse(raw) as MidtransSnapResponse) : {}; } catch { payload = {}; }

  if (!midtransResponse.ok || !payload.token) {
    logger.error("MIDTRANS_API_ERROR", {
      requestId,
      orderId,
      orderNumber: order.order_number,
      environment: isProduction ? "production" : "sandbox",
      providerStatus: midtransResponse.status,
      providerMessage: payload.status_message ?? payload.error_messages?.[0] ?? "UNKNOWN_PROVIDER_ERROR",
      grossAmount,
      providerDurationMs: elapsedMs(providerStartedAt),
      durationMs: elapsedMs(startedAt),
    });
    return { status: 502, body: { error: "Payment service is temporarily unavailable. Your reservation remains active. Please try again in a few minutes." } };
  }

  logger.info("MIDTRANS_SNAP_CREATED", { requestId, orderId, orderNumber: order.order_number, grossAmount, environment: isProduction ? "production" : "sandbox", providerDurationMs: elapsedMs(providerStartedAt), durationMs: elapsedMs(startedAt) });
  return { status: 200, body: { token: payload.token, redirectUrl: payload.redirect_url } };
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    logger.warn("INVALID_PAYMENT_REQUEST", { requestId });
    return NextResponse.json({ error: "INVALID_PAYMENT_REQUEST" }, { status: 400 });
  }

  const now = Date.now();
  pruneSnapCache(now);
  const existing = snapCache.get(parsed.data.orderId);
  const replayed = Boolean(existing);
  const promise = existing?.promise ?? createSnapToken(parsed.data.orderId, requestId);

  if (!existing) {
    snapCache.set(parsed.data.orderId, { expiresAt: now + SNAP_CACHE_TTL_MS, promise });
    void promise.then((result) => { if (result.status < 200 || result.status >= 300) snapCache.delete(parsed.data.orderId); });
  } else {
    logger.info("MIDTRANS_SNAP_REPLAYED", { requestId, orderId: parsed.data.orderId });
  }

  const result = await promise;
  return NextResponse.json(result.body, { status: result.status, headers: { "x-request-id": requestId, ...(replayed ? { "Idempotency-Replayed": "true" } : {}) } });
}
