import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ADMIN_CANCEL_MARKER } from "@/lib/admin/order-actions";
import { applyPaymentStateFallback } from "@/lib/commerce/payment-state-fallback";
import { apiError, readJsonBody } from "@/lib/http/api";
import { sendMetaPurchaseEvent } from "@/lib/marketing/meta-conversions";
import { sendTelegramPaidOrder } from "@/lib/notifications/telegram";
import { elapsedMs, logger, requestIdFrom } from "@/lib/observability/logger";

const notificationSchema = z.object({
  order_id: z.string().min(1).max(100),
  status_code: z.string().min(1).max(10),
  gross_amount: z.string().min(1).max(32),
  signature_key: z.string().length(128),
  transaction_id: z.string().min(1).max(100).optional(),
  transaction_status: z.string().min(1).max(50),
  fraud_status: z.string().max(50).optional(),
});

type PaymentStatus = "paid" | "expired" | "pending";

type OrderRow = {
  id: string;
  order_number: string;
  customer_name: string;
  email: string;
  whatsapp: string;
  province: string;
  city: string;
  postal_code: string;
  total_idr: number;
  payment_status: string;
  notes: string | null;
};

type OrderItemRow = {
  sku: string;
  product_name: string;
  variant_name: string | null;
  quantity: number;
  unit_price_idr: number;
};

type ShipmentRow = {
  courier: string | null;
  service: string | null;
};

type MidtransStatusResponse = {
  order_id?: string;
  status_code?: string;
  gross_amount?: string;
  transaction_id?: string;
  transaction_status?: string;
  fraud_status?: string;
  status_message?: string;
};

function secureEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function parseGrossAmount(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) && Number.isInteger(amount) && amount >= 0 ? amount : null;
}

function normalizePaymentStatus(transactionStatus: string, fraudStatus?: string): PaymentStatus {
  if (transactionStatus === "settlement") return "paid";
  if (transactionStatus === "capture" && fraudStatus === "accept") return "paid";
  if (["expire", "cancel", "deny"].includes(transactionStatus)) return "expired";
  return "pending";
}

async function readOrderItems(input: {
  supabaseUrl: string;
  databaseHeaders: Record<string, string>;
  orderId: string;
}) {
  const response = await fetch(
    `${input.supabaseUrl}/rest/v1/order_items?order_id=eq.${encodeURIComponent(input.orderId)}&select=sku,product_name,variant_name,quantity,unit_price_idr&order=created_at.asc`,
    { headers: input.databaseHeaders, cache: "no-store" },
  );
  if (!response.ok) throw new Error(`ORDER_ITEMS_LOOKUP_FAILED:${response.status}`);
  return (await response.json()) as OrderItemRow[];
}

async function readShipment(input: {
  supabaseUrl: string;
  databaseHeaders: Record<string, string>;
  orderId: string;
}) {
  const response = await fetch(
    `${input.supabaseUrl}/rest/v1/shipments?order_id=eq.${encodeURIComponent(input.orderId)}&select=courier,service&limit=1`,
    { headers: input.databaseHeaders, cache: "no-store" },
  );
  if (!response.ok) return null;
  return ((await response.json()) as ShipmentRow[])[0] ?? null;
}

async function reportPaidOrderToMeta(input: {
  order: OrderRow;
  items: OrderItemRow[];
  isProduction: boolean;
  requestId: string;
}) {
  if (!input.isProduction) {
    logger.info("META_PURCHASE_SKIPPED_SANDBOX", {
      requestId: input.requestId,
      orderId: input.order.id,
      orderNumber: input.order.order_number,
    });
    return;
  }

  try {
    const result = await sendMetaPurchaseEvent({
      id: input.order.id,
      orderNumber: input.order.order_number,
      customerName: input.order.customer_name,
      email: input.order.email,
      whatsapp: input.order.whatsapp,
      province: input.order.province,
      city: input.order.city,
      postalCode: input.order.postal_code,
      totalIdr: input.order.total_idr,
      items: input.items.map((item) => ({
        sku: item.sku,
        quantity: item.quantity,
        unitPriceIdr: item.unit_price_idr,
      })),
    });

    logger.info(result.sent ? "META_PURCHASE_SENT" : "META_PURCHASE_NOT_CONFIGURED", {
      requestId: input.requestId,
      orderId: input.order.id,
      orderNumber: input.order.order_number,
      eventsReceived: result.sent ? result.eventsReceived : null,
    });
  } catch (error) {
    logger.error("META_PURCHASE_SEND_FAILED", {
      requestId: input.requestId,
      orderId: input.order.id,
      orderNumber: input.order.order_number,
      message: error instanceof Error ? error.message : "UNKNOWN_ERROR",
    });
  }
}

async function notifyNewPaidOrder(input: {
  order: OrderRow;
  supabaseUrl: string;
  databaseHeaders: Record<string, string>;
  isProduction: boolean;
  requestId: string;
}) {
  let items: OrderItemRow[] = [];
  try {
    items = await readOrderItems(input);
  } catch (error) {
    logger.error("PAID_ORDER_ITEMS_LOOKUP_FAILED", {
      requestId: input.requestId,
      orderId: input.order.id,
      orderNumber: input.order.order_number,
      message: error instanceof Error ? error.message : "UNKNOWN_ERROR",
    });
  }

  const shipment = await readShipment(input);

  try {
    const result = await sendTelegramPaidOrder({
      orderNumber: input.order.order_number,
      customerName: input.order.customer_name,
      totalIdr: input.order.total_idr,
      courier: shipment?.courier ?? null,
      service: shipment?.service ?? null,
      items: items.map((item) => ({
        name: item.product_name,
        variantName: item.variant_name,
        quantity: item.quantity,
      })),
    });

    logger.info(result.sent ? "TELEGRAM_PAID_ORDER_SENT" : "TELEGRAM_PAID_ORDER_NOT_CONFIGURED", {
      requestId: input.requestId,
      orderId: input.order.id,
      orderNumber: input.order.order_number,
      environment: input.isProduction ? "production" : "sandbox",
    });
  } catch (error) {
    logger.error("TELEGRAM_PAID_ORDER_SEND_FAILED", {
      requestId: input.requestId,
      orderId: input.order.id,
      orderNumber: input.order.order_number,
      message: error instanceof Error ? error.message : "UNKNOWN_ERROR",
    });
  }

  if (items.length > 0) {
    await reportPaidOrderToMeta({
      order: input.order,
      items,
      isProduction: input.isProduction,
      requestId: input.requestId,
    });
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  const startedAt = performance.now();
  const body = await readJsonBody(request);

  if (!body.ok) {
    logger.warn("MIDTRANS_WEBHOOK_INVALID_BODY", { requestId, code: body.code });
    return apiError(
      requestId,
      body.code,
      body.code === "PAYLOAD_TOO_LARGE"
        ? "Notification body exceeds the 64 KB limit."
        : "Notification body must contain valid JSON.",
      body.status,
    );
  }

  const parsed = notificationSchema.safeParse(body.value);
  if (!parsed.success) {
    logger.warn("MIDTRANS_WEBHOOK_INVALID_BODY", {
      requestId,
      issues: parsed.error.issues.map((issue) => issue.path.join(".")),
    });
    return apiError(requestId, "INVALID_NOTIFICATION", "The Midtrans notification payload is invalid.", 400, parsed.error.flatten());
  }

  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";

  if (!serverKey || !supabaseUrl || !serviceRoleKey) {
    logger.error("MIDTRANS_WEBHOOK_CONFIGURATION_ERROR", {
      requestId,
      hasServerKey: Boolean(serverKey),
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceRoleKey: Boolean(serviceRoleKey),
    });
    return apiError(requestId, "PAYMENT_NOT_CONFIGURED", "Payment processing is not configured.", 503);
  }

  const payload = parsed.data;
  const expectedSignature = createHash("sha512")
    .update(`${payload.order_id}${payload.status_code}${payload.gross_amount}${serverKey}`)
    .digest("hex");

  if (!secureEqual(expectedSignature, payload.signature_key.toLowerCase())) {
    logger.warn("MIDTRANS_WEBHOOK_INVALID_SIGNATURE", {
      requestId,
      orderNumber: payload.order_id,
      transactionId: payload.transaction_id ?? null,
    });
    return apiError(requestId, "INVALID_SIGNATURE", "The notification signature is invalid.", 401);
  }

  const databaseHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  const orderResponse = await fetch(
    `${supabaseUrl}/rest/v1/orders?order_number=eq.${encodeURIComponent(payload.order_id)}&select=id,order_number,customer_name,email,whatsapp,province,city,postal_code,total_idr,payment_status,notes&limit=1`,
    { headers: databaseHeaders, cache: "no-store" },
  );

  if (!orderResponse.ok) {
    logger.error("MIDTRANS_WEBHOOK_ORDER_LOOKUP_FAILED", {
      requestId,
      orderNumber: payload.order_id,
      databaseStatus: orderResponse.status,
    });
    return apiError(requestId, "ORDER_LOOKUP_FAILED", "The order could not be verified.", 502);
  }

  const order = ((await orderResponse.json()) as OrderRow[])[0];
  if (!order) return apiError(requestId, "ORDER_NOT_FOUND", "The referenced order does not exist.", 404);

  const notifiedAmount = parseGrossAmount(payload.gross_amount);
  if (notifiedAmount === null || notifiedAmount !== order.total_idr) {
    logger.error("MIDTRANS_WEBHOOK_AMOUNT_MISMATCH", {
      requestId,
      orderNumber: payload.order_id,
      expectedAmount: order.total_idr,
      notifiedAmount,
    });
    return apiError(requestId, "AMOUNT_MISMATCH", "The notified amount does not match the order total.", 409);
  }

  const adminCancelled = order.notes?.startsWith(ADMIN_CANCEL_MARKER) ?? false;
  if (order.payment_status === "refunded" || adminCancelled) {
    logger.info("MIDTRANS_WEBHOOK_IGNORED_CANCELLED_ORDER", {
      requestId,
      orderId: order.id,
      orderNumber: order.order_number,
    });
    return NextResponse.json(
      { received: true, ignored: true, requestId },
      { headers: { "x-request-id": requestId, "Cache-Control": "no-store, max-age=0" } },
    );
  }

  let transactionStatus = payload.transaction_status;
  let fraudStatus = payload.fraud_status;
  let transactionId = payload.transaction_id ?? null;
  let verifiedStatus: MidtransStatusResponse | null = null;
  const statusBaseUrl = isProduction ? "https://api.midtrans.com/v2" : "https://api.sandbox.midtrans.com/v2";

  try {
    const statusResponse = await fetch(`${statusBaseUrl}/${encodeURIComponent(payload.order_id)}/status`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    const candidate = (await statusResponse.json().catch(() => ({}))) as MidtransStatusResponse;
    const verifiedAmount = candidate.gross_amount ? parseGrossAmount(candidate.gross_amount) : null;

    if (
      statusResponse.ok &&
      candidate.transaction_status &&
      candidate.order_id === order.order_number &&
      verifiedAmount === order.total_idr
    ) {
      verifiedStatus = candidate;
      transactionStatus = candidate.transaction_status;
      fraudStatus = candidate.fraud_status;
      transactionId = candidate.transaction_id ?? transactionId;
    } else {
      logger.warn("MIDTRANS_STATUS_VERIFICATION_SKIPPED", {
        requestId,
        orderNumber: order.order_number,
        providerHttpStatus: statusResponse.status,
      });
    }
  } catch (error) {
    logger.warn("MIDTRANS_STATUS_VERIFICATION_UNAVAILABLE", {
      requestId,
      orderNumber: order.order_number,
      message: error instanceof Error ? error.message : "UNKNOWN_ERROR",
    });
  }

  const normalizedStatus = normalizePaymentStatus(transactionStatus, fraudStatus);

  if (order.payment_status === "paid" && normalizedStatus !== "paid") {
    logger.info("MIDTRANS_WEBHOOK_IGNORED_STALE_STATUS", {
      requestId,
      orderId: order.id,
      orderNumber: order.order_number,
      normalizedStatus,
    });
    return NextResponse.json(
      { received: true, ignored: true, requestId },
      { headers: { "x-request-id": requestId, "Cache-Control": "no-store, max-age=0" } },
    );
  }

  const rawPayload = {
    notification: payload,
    verified_status: verifiedStatus,
    verification_source: verifiedStatus ? "status_api" : "signed_notification",
  };

  const updateStartedAt = performance.now();
  const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/apply_midtrans_notification`, {
    method: "POST",
    headers: { ...databaseHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      p_order_number: order.order_number,
      p_payment_status: normalizedStatus,
      p_provider_transaction_id: transactionId,
      p_provider_status: transactionStatus,
      p_raw_payload: rawPayload,
    }),
    cache: "no-store",
  });

  let fallbackApplied = false;
  if (!rpcResponse.ok) {
    const databaseFailure = (await rpcResponse.json().catch(() => ({}))) as Record<string, unknown>;
    logger.warn("MIDTRANS_WEBHOOK_RPC_FAILED_USING_FALLBACK", {
      requestId,
      orderNumber: order.order_number,
      databaseStatus: rpcResponse.status,
      databaseCode: databaseFailure.code ?? null,
    });

    try {
      await applyPaymentStateFallback({
        supabaseUrl,
        serviceRoleKey,
        orderNumber: order.order_number,
        paymentStatus: normalizedStatus,
        providerTransactionId: transactionId,
        providerStatus: transactionStatus,
        rawPayload,
      });
      fallbackApplied = true;
    } catch (fallbackError) {
      logger.error("MIDTRANS_WEBHOOK_UPDATE_FAILED", {
        requestId,
        orderNumber: order.order_number,
        fallbackMessage: fallbackError instanceof Error ? fallbackError.message : "UNKNOWN_ERROR",
      });
      return apiError(requestId, "PAYMENT_UPDATE_FAILED", "The payment status could not be applied.", 502);
    }
  }

  const duplicate = order.payment_status === normalizedStatus;
  if (normalizedStatus === "paid" && !duplicate) {
    await notifyNewPaidOrder({
      order,
      supabaseUrl,
      databaseHeaders,
      isProduction,
      requestId,
    });
  }

  logger.info("MIDTRANS_WEBHOOK_APPLIED", {
    requestId,
    orderId: order.id,
    orderNumber: order.order_number,
    transactionId,
    previousStatus: order.payment_status,
    providerStatus: transactionStatus,
    normalizedStatus,
    duplicate,
    fallbackApplied,
    verificationSource: verifiedStatus ? "status_api" : "signed_notification",
    databaseUpdateDurationMs: elapsedMs(updateStartedAt),
    durationMs: elapsedMs(startedAt),
  });

  return NextResponse.json(
    { received: true, requestId },
    { headers: { "x-request-id": requestId, "Cache-Control": "no-store, max-age=0" } },
  );
}
