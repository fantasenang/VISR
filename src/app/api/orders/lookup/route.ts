import { NextResponse } from "next/server";
import { applyPaymentStateFallback } from "@/lib/commerce/payment-state-fallback";
import { elapsedMs, logger, requestIdFrom } from "@/lib/observability/logger";

type LookupRequest = { orderNumber?: unknown; contact?: unknown };
type OrderRow = { id: string; order_number: string; batch_code: string; customer_name: string; email: string; whatsapp: string; address_line: string; province: string; city: string; postal_code: string; subtotal_idr: number; shipping_cost_idr: number; total_idr: number; payment_status: string; fulfillment_status: string; payment_expires_at: string; paid_at: string | null; created_at: string };
type OrderItemRow = { sku: string; product_name: string; variant_name: string | null; quantity: number; unit_price_idr: number; line_total_idr: number };
type ShipmentRow = { courier: string | null; service: string | null; tracking_number: string | null; shipped_at: string | null; delivered_at: string | null };
type MidtransStatusResponse = { order_id?: string; gross_amount?: string; transaction_id?: string; transaction_status?: string; fraud_status?: string };

function normalizeOrderNumber(value: string) { return value.trim().toUpperCase(); }
function normalizeEmail(value: string) { return value.trim().toLowerCase(); }
function normalizePhone(value: string) { const digits = value.replace(/\D/g, ""); if (digits.startsWith("0")) return `62${digits.slice(1)}`; return digits; }
function contactMatches(order: OrderRow, contact: string) { return normalizeEmail(order.email) === normalizeEmail(contact) || normalizePhone(order.whatsapp) === normalizePhone(contact); }
function supabaseHeaders(serviceRoleKey: string) { return { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` }; }
function normalizedPaymentStatus(transactionStatus: string, fraudStatus?: string) { if (transactionStatus === "settlement") return "paid" as const; if (transactionStatus === "capture" && fraudStatus === "accept") return "paid" as const; if (["expire", "cancel", "deny"].includes(transactionStatus)) return "expired" as const; return "pending" as const; }

async function reconcilePendingOrder(order: OrderRow, supabaseUrl: string, serviceRoleKey: string, requestId: string) {
  if (order.payment_status !== "pending") return order;
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) return order;
  const startedAt = performance.now();
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
  const statusBaseUrl = isProduction ? "https://api.midtrans.com/v2" : "https://api.sandbox.midtrans.com/v2";
  try {
    const statusResponse = await fetch(`${statusBaseUrl}/${encodeURIComponent(order.order_number)}/status`, { headers: { Authorization: `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`, Accept: "application/json" }, cache: "no-store" });
    if (!statusResponse.ok) {
      logger.warn("ORDER_LOOKUP_RECONCILIATION_SKIPPED", { requestId, orderNumber: order.order_number, providerStatusCode: statusResponse.status, durationMs: elapsedMs(startedAt) });
      return order;
    }
    const status = (await statusResponse.json()) as MidtransStatusResponse;
    const grossAmount = Number(status.gross_amount);
    if (status.order_id !== order.order_number || !Number.isFinite(grossAmount) || grossAmount !== order.total_idr || !status.transaction_status) {
      logger.warn("ORDER_LOOKUP_RECONCILIATION_MISMATCH", { requestId, orderNumber: order.order_number, providerOrderNumber: status.order_id ?? null, expectedAmount: order.total_idr, providerAmount: status.gross_amount ?? null, durationMs: elapsedMs(startedAt) });
      return order;
    }
    const paymentStatus = normalizedPaymentStatus(status.transaction_status, status.fraud_status);
    if (paymentStatus === "pending") return order;
    const rawPayload = { source: "order_lookup_reconciliation", verified_status: status };
    const applyStartedAt = performance.now();
    const applyResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/apply_midtrans_notification`, { method: "POST", headers: { ...supabaseHeaders(serviceRoleKey), "Content-Type": "application/json" }, body: JSON.stringify({ p_order_number: order.order_number, p_payment_status: paymentStatus, p_provider_transaction_id: status.transaction_id ?? null, p_provider_status: status.transaction_status, p_raw_payload: rawPayload }), cache: "no-store" });
    let fallbackApplied = false;
    if (!applyResponse.ok) {
      try {
        await applyPaymentStateFallback({
          supabaseUrl,
          serviceRoleKey,
          orderNumber: order.order_number,
          paymentStatus,
          providerTransactionId: status.transaction_id ?? null,
          providerStatus: status.transaction_status,
          rawPayload,
        });
        fallbackApplied = true;
      } catch (fallbackError) {
        logger.error("ORDER_LOOKUP_RECONCILIATION_FAILED", { requestId, orderNumber: order.order_number, providerStatus: status.transaction_status, databaseStatus: applyResponse.status, fallbackMessage: fallbackError instanceof Error ? fallbackError.message : "UNKNOWN_ERROR", databaseDurationMs: elapsedMs(applyStartedAt), durationMs: elapsedMs(startedAt) });
        return order;
      }
    }
    logger.info("ORDER_LOOKUP_RECONCILED", { requestId, orderNumber: order.order_number, previousStatus: order.payment_status, providerStatus: status.transaction_status, paymentStatus, fallbackApplied, databaseDurationMs: elapsedMs(applyStartedAt), durationMs: elapsedMs(startedAt) });
    return { ...order, payment_status: paymentStatus, fulfillment_status: paymentStatus === "paid" ? "confirmed" : order.fulfillment_status, paid_at: paymentStatus === "paid" ? order.paid_at ?? new Date().toISOString() : order.paid_at };
  } catch (error) {
    logger.error("ORDER_LOOKUP_RECONCILIATION_ERROR", { requestId, orderNumber: order.order_number, message: error instanceof Error ? error.message : "UNKNOWN_ERROR", durationMs: elapsedMs(startedAt) });
    return order;
  }
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  const requestId = requestIdFrom(request);
  const body = (await request.json().catch(() => null)) as LookupRequest | null;
  const orderNumber = typeof body?.orderNumber === "string" ? normalizeOrderNumber(body.orderNumber) : "";
  const contact = typeof body?.contact === "string" ? body.contact.trim() : "";
  const responseHeaders = { "Cache-Control": "no-store, max-age=0", "x-request-id": requestId };

  if (!/^VISR\.B\d{2}\.\d{8}\.\d{3,}$/.test(orderNumber) || contact.length < 5 || contact.length > 254) {
    logger.warn("ORDER_LOOKUP_INVALID_REQUEST", { requestId, durationMs: elapsedMs(startedAt) });
    return NextResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404, headers: responseHeaders });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    logger.error("ORDER_LOOKUP_CONFIGURATION_ERROR", { requestId, durationMs: elapsedMs(startedAt) });
    return NextResponse.json({ error: "COMMERCE_NOT_CONFIGURED" }, { status: 503, headers: responseHeaders });
  }

  const databaseHeaders = supabaseHeaders(serviceRoleKey);
  const orderQuery = new URL(`${supabaseUrl}/rest/v1/orders`);
  orderQuery.searchParams.set("select", "id,order_number,batch_code,customer_name,email,whatsapp,address_line,province,city,postal_code,subtotal_idr,shipping_cost_idr,total_idr,payment_status,fulfillment_status,payment_expires_at,paid_at,created_at");
  orderQuery.searchParams.set("order_number", `eq.${orderNumber}`);
  orderQuery.searchParams.set("limit", "1");
  const orderLookupStartedAt = performance.now();
  const orderResponse = await fetch(orderQuery, { headers: databaseHeaders, cache: "no-store" });
  if (!orderResponse.ok) {
    logger.error("ORDER_LOOKUP_DATABASE_FAILED", { requestId, databaseStatus: orderResponse.status, databaseDurationMs: elapsedMs(orderLookupStartedAt), durationMs: elapsedMs(startedAt) });
    return NextResponse.json({ error: "ORDER_LOOKUP_FAILED" }, { status: 502, headers: responseHeaders });
  }

  const orders = (await orderResponse.json()) as OrderRow[];
  const foundOrder = orders[0];
  if (!foundOrder || !contactMatches(foundOrder, contact)) {
    logger.warn("ORDER_LOOKUP_NOT_FOUND", { requestId, orderNumber, databaseDurationMs: elapsedMs(orderLookupStartedAt), durationMs: elapsedMs(startedAt) });
    return NextResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404, headers: responseHeaders });
  }

  const order = await reconcilePendingOrder(foundOrder, supabaseUrl, serviceRoleKey, requestId);
  const itemsQuery = new URL(`${supabaseUrl}/rest/v1/order_items`);
  itemsQuery.searchParams.set("select", "sku,product_name,variant_name,quantity,unit_price_idr,line_total_idr"); itemsQuery.searchParams.set("order_id", `eq.${order.id}`); itemsQuery.searchParams.set("order", "created_at.asc");
  const shipmentQuery = new URL(`${supabaseUrl}/rest/v1/shipments`);
  shipmentQuery.searchParams.set("select", "courier,service,tracking_number,shipped_at,delivered_at"); shipmentQuery.searchParams.set("order_id", `eq.${order.id}`); shipmentQuery.searchParams.set("limit", "1");
  const detailStartedAt = performance.now();
  const [itemsResponse, shipmentResponse] = await Promise.all([fetch(itemsQuery, { headers: databaseHeaders, cache: "no-store" }), fetch(shipmentQuery, { headers: databaseHeaders, cache: "no-store" })]);
  if (!itemsResponse.ok || !shipmentResponse.ok) {
    logger.error("ORDER_LOOKUP_DETAILS_FAILED", { requestId, orderNumber: order.order_number, itemsStatus: itemsResponse.status, shipmentStatus: shipmentResponse.status, databaseDurationMs: elapsedMs(detailStartedAt), durationMs: elapsedMs(startedAt) });
    return NextResponse.json({ error: "ORDER_LOOKUP_FAILED" }, { status: 502, headers: responseHeaders });
  }

  const items = (await itemsResponse.json()) as OrderItemRow[];
  const shipments = (await shipmentResponse.json()) as ShipmentRow[];
  logger.info("ORDER_LOOKUP_SUCCEEDED", { requestId, orderNumber: order.order_number, paymentStatus: order.payment_status, fulfillmentStatus: order.fulfillment_status, itemCount: items.length, hasShipment: Boolean(shipments[0]), detailDurationMs: elapsedMs(detailStartedAt), durationMs: elapsedMs(startedAt) });

  return NextResponse.json({ order: { orderNumber: order.order_number, batchCode: order.batch_code, customerName: order.customer_name, email: order.email, whatsapp: order.whatsapp, deliveryAddress: { address: order.address_line, province: order.province, city: order.city, postalCode: order.postal_code }, subtotalIdr: order.subtotal_idr, shippingCostIdr: order.shipping_cost_idr, totalIdr: order.total_idr, paymentStatus: order.payment_status, fulfillmentStatus: order.fulfillment_status, paymentExpiresAt: order.payment_expires_at, paidAt: order.paid_at, createdAt: order.created_at, items: items.map((item) => ({ sku: item.sku, name: item.product_name, variant: item.variant_name, quantity: item.quantity, unitPriceIdr: item.unit_price_idr, lineTotalIdr: item.line_total_idr })), shipment: shipments[0] ? { courier: shipments[0].courier, service: shipments[0].service, trackingNumber: shipments[0].tracking_number, shippedAt: shipments[0].shipped_at, deliveredAt: shipments[0].delivered_at } : null } }, { headers: responseHeaders });
}
