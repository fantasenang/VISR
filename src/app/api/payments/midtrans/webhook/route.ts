import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ADMIN_CANCEL_MARKER } from "@/lib/admin/order-actions";
import { sendMetaPurchaseEvent } from "@/lib/marketing/meta-conversions";
import { elapsedMs, logger, requestIdFrom } from "@/lib/observability/logger";
import { apiError, readJsonBody } from "@/lib/http/api";

const notificationSchema = z.object({
  order_id: z.string().min(1).max(100),
  status_code: z.string().min(1).max(10),
  gross_amount: z.string().min(1).max(32),
  signature_key: z.string().length(128),
  transaction_id: z.string().min(1).max(100).optional(),
  transaction_status: z.string().min(1).max(50),
  fraud_status: z.string().max(50).optional(),
});

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
  quantity: number;
  unit_price_idr: number;
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

function normalizePaymentStatus(transactionStatus: string, fraudStatus?: string) {
  if (transactionStatus === "settlement") return "paid" as const;
  if (transactionStatus === "capture" && fraudStatus === "accept") return "paid" as const;
  if (["expire", "cancel", "deny"].includes(transactionStatus)) return "expired" as const;
  return "pending" as const;
}

async function reportPaidOrderToMeta(input: {
  order: OrderRow;
  normalizedStatus: "paid" | "expired" | "pending";
  isProduction: boolean;
  supabaseUrl: string;
  databaseHeaders: Record<string, string>;
  requestId: string;
}) {
  const { order, normalizedStatus, isProduction, supabaseUrl, databaseHeaders, requestId } = input;
  if (normalizedStatus !== "paid" || order.payment_status === "paid") return;

  if (!isProduction) {
    logger.info("META_PURCHASE_SKIPPED_SANDBOX", {
      requestId,
      orderId: order.id,
      orderNumber: order.order_number,
    });
    return;
  }

  const itemsStartedAt = performance.now();
  const itemsResponse = await fetch(
    `${supabaseUrl}/rest/v1/order_items?order_id=eq.${encodeURIComponent(order.id)}&select=sku,quantity,unit_price_idr&order=created_at.asc`,
    { headers: databaseHeaders, cache: "no-store" },
  );
  const itemsLookupDurationMs = elapsedMs(itemsStartedAt);

  if (!itemsResponse.ok) {
    logger.error("META_PURCHASE_ITEMS_LOOKUP_FAILED", {
      requestId,
      orderId: order.id,
      orderNumber: order.order_number,
      databaseStatus: itemsResponse.status,
      itemsLookupDurationMs,
    });
    return;
  }

  const items = (await itemsResponse.json()) as OrderItemRow[];
  if (items.length === 0) {
    logger.error("META_PURCHASE_ITEMS_EMPTY", {
      requestId,
      orderId: order.id,
      orderNumber: order.order_number,
      itemsLookupDurationMs,
    });
    return;
  }

  const metaStartedAt = performance.now();
  try {
    const result = await sendMetaPurchaseEvent({
      id: order.id,
      orderNumber: order.order_number,
      customerName: order.customer_name,
      email: order.email,
      whatsapp: order.whatsapp,
      province: order.province,
      city: order.city,
      postalCode: order.postal_code,
      totalIdr: order.total_idr,
      items: items.map((item) => ({
        sku: item.sku,
        quantity: item.quantity,
        unitPriceIdr: item.unit_price_idr,
      })),
    });

    if (!result.sent) {
      logger.warn("META_PURCHASE_NOT_CONFIGURED", {
        requestId,
        orderId: order.id,
        orderNumber: order.order_number,
        durationMs: elapsedMs(metaStartedAt),
      });
      return;
    }

    logger.info("META_PURCHASE_SENT", {
      requestId,
      orderId: order.id,
      orderNumber: order.order_number,
      eventsReceived: result.eventsReceived,
      traceId: result.traceId,
      testEvent: result.testEvent,
      itemsLookupDurationMs,
      durationMs: elapsedMs(metaStartedAt),
    });
  } catch (error) {
    logger.error("META_PURCHASE_SEND_FAILED", {
      requestId,
      orderId: order.id,
      orderNumber: order.order_number,
      message: error instanceof Error ? error.message : "UNKNOWN_ERROR",
      itemsLookupDurationMs,
      durationMs: elapsedMs(metaStartedAt),
    });
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  const startedAt = performance.now();
  const body = await readJsonBody(request);
  if (!body.ok) {
    logger.warn("MIDTRANS_WEBHOOK_INVALID_BODY", { requestId, code: body.code, durationMs: elapsedMs(startedAt) });
    return apiError(
      requestId,
      body.code,
      body.code === "PAYLOAD_TOO_LARGE" ? "Notification body exceeds the 64 KB limit." : "Notification body must contain valid JSON.",
      body.status,
    );
  }

  const parsed = notificationSchema.safeParse(body.value);
  if (!parsed.success) {
    logger.warn("MIDTRANS_WEBHOOK_INVALID_BODY", {
      requestId,
      issues: parsed.error.issues.map((issue) => issue.path.join(".")),
      durationMs: elapsedMs(startedAt),
    });
    return apiError(requestId, "INVALID_NOTIFICATION", "The Midtrans notification payload is invalid.", 400, parsed.error.flatten());
  }

  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";

  if (!serverKey || !supabaseUrl || !serviceRoleKey) {
    logger.error("MIDTRANS_WEBHOOK_CONFIGURATION_ERROR", {
      requestId,
      hasServerKey: Boolean(serverKey),
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceRoleKey: Boolean(serviceRoleKey),
      environment: isProduction ? "production" : "sandbox",
      durationMs: elapsedMs(startedAt),
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
      providerStatus: payload.transaction_status,
      durationMs: elapsedMs(startedAt),
    });
    return apiError(requestId, "INVALID_SIGNATURE", "The notification signature is invalid.", 401);
  }

  const databaseHeaders = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
  const lookupStartedAt = performance.now();
  const orderResponse = await fetch(
    `${supabaseUrl}/rest/v1/orders?order_number=eq.${encodeURIComponent(payload.order_id)}&select=id,order_number,customer_name,email,whatsapp,province,city,postal_code,total_idr,payment_status,notes&limit=1`,
    { headers: databaseHeaders, cache: "no-store" },
  );
  const orderLookupDurationMs = elapsedMs(lookupStartedAt);

  if (!orderResponse.ok) {
    logger.error("MIDTRANS_WEBHOOK_ORDER_LOOKUP_FAILED", {
      requestId,
      orderNumber: payload.order_id,
      databaseStatus: orderResponse.status,
      orderLookupDurationMs,
      durationMs: elapsedMs(startedAt),
    });
    return apiError(requestId, "ORDER_LOOKUP_FAILED", "The order could not be verified.", 502);
  }

  const orders = (await orderResponse.json()) as OrderRow[];
  const order = orders[0];
  if (!order) {
    logger.warn("MIDTRANS_WEBHOOK_ORDER_NOT_FOUND", { requestId, orderNumber: payload.order_id, orderLookupDurationMs, durationMs: elapsedMs(startedAt) });
    return apiError(requestId, "ORDER_NOT_FOUND", "The referenced order does not exist.", 404);
  }

  const notifiedAmount = parseGrossAmount(payload.gross_amount);
  if (notifiedAmount === null || notifiedAmount !== order.total_idr) {
    logger.error("MIDTRANS_WEBHOOK_AMOUNT_MISMATCH", {
      requestId,
      orderNumber: payload.order_id,
      expectedAmount: order.total_idr,
      notifiedAmount,
      transactionId: payload.transaction_id ?? null,
      durationMs: elapsedMs(startedAt),
    });
    return apiError(requestId, "AMOUNT_MISMATCH", "The notified amount does not match the order total.", 409);
  }

  const adminCancelled = order.notes?.startsWith(ADMIN_CANCEL_MARKER) ?? false;
  if (order.payment_status === "refunded" || adminCancelled) {
    logger.info("MIDTRANS_WEBHOOK_IGNORED_CANCELLED_ORDER", {
      requestId,
      orderId: order.id,
      orderNumber: order.order_number,
      paymentStatus: order.payment_status,
      providerStatus: payload.transaction_status,
      transactionId: payload.transaction_id ?? null,
      orderLookupDurationMs,
      durationMs: elapsedMs(startedAt),
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
  let verificationDurationMs: number | null = null;
  const statusBaseUrl = isProduction ? "https://api.midtrans.com/v2" : "https://api.sandbox.midtrans.com/v2";

  try {
    const verificationStartedAt = performance.now();
    const statusResponse = await fetch(`${statusBaseUrl}/${encodeURIComponent(payload.order_id)}/status`, {
      headers: { Authorization: `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`, Accept: "application/json" },
      cache: "no-store",
    });
    verificationDurationMs = elapsedMs(verificationStartedAt);
    const candidate = (await statusResponse.json().catch(() => ({}))) as MidtransStatusResponse;
    const verifiedAmount = candidate.gross_amount ? parseGrossAmount(candidate.gross_amount) : null;

    if (statusResponse.ok && candidate.transaction_status && candidate.order_id === order.order_number && verifiedAmount === order.total_idr) {
      verifiedStatus = candidate;
      transactionStatus = candidate.transaction_status;
      fraudStatus = candidate.fraud_status;
      transactionId = candidate.transaction_id ?? transactionId;
    } else {
      logger.warn("MIDTRANS_STATUS_VERIFICATION_SKIPPED", {
        requestId,
        environment: isProduction ? "production" : "sandbox",
        orderNumber: order.order_number,
        providerHttpStatus: statusResponse.status,
        providerStatusMessage: candidate.status_message ?? null,
        verificationDurationMs,
      });
    }
  } catch (error) {
    logger.warn("MIDTRANS_STATUS_VERIFICATION_UNAVAILABLE", {
      requestId,
      orderNumber: order.order_number,
      message: error instanceof Error ? error.message : "unknown",
      verificationDurationMs,
    });
  }

  const normalizedStatus = normalizePaymentStatus(transactionStatus, fraudStatus);
  const updateStartedAt = performance.now();
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/apply_midtrans_notification`, {
    method: "POST",
    headers: { ...databaseHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      p_order_number: order.order_number,
      p_payment_status: normalizedStatus,
      p_provider_transaction_id: transactionId,
      p_provider_status: transactionStatus,
      p_raw_payload: {
        notification: payload,
        verified_status: verifiedStatus,
        verification_source: verifiedStatus ? "status_api" : "signed_notification",
      },
    }),
    cache: "no-store",
  });
  const databaseUpdateDurationMs = elapsedMs(updateStartedAt);

  if (!response.ok) {
    const databaseFailure = await response.json().catch(() => ({})) as Record<string, unknown>;
    logger.error("MIDTRANS_WEBHOOK_UPDATE_FAILED", {
      requestId,
      orderNumber: order.order_number,
      transactionId,
      providerStatus: transactionStatus,
      normalizedStatus,
      databaseStatus: response.status,
      databaseCode: databaseFailure.code ?? null,
      databaseMessage: databaseFailure.message ?? null,
      databaseUpdateDurationMs,
      durationMs: elapsedMs(startedAt),
    });
    return apiError(requestId, "PAYMENT_UPDATE_FAILED", "The payment status could not be applied.", 502);
  }

  await reportPaidOrderToMeta({
    order,
    normalizedStatus,
    isProduction,
    supabaseUrl,
    databaseHeaders,
    requestId,
  });

  const duplicate = order.payment_status === normalizedStatus;
  logger.info("MIDTRANS_WEBHOOK_APPLIED", {
    requestId,
    orderId: order.id,
    orderNumber: order.order_number,
    transactionId,
    previousStatus: order.payment_status,
    providerStatus: transactionStatus,
    normalizedStatus,
    duplicate,
    verificationSource: verifiedStatus ? "status_api" : "signed_notification",
    orderLookupDurationMs,
    verificationDurationMs,
    databaseUpdateDurationMs,
    durationMs: elapsedMs(startedAt),
  });

  return NextResponse.json(
    { received: true, requestId },
    { headers: { "x-request-id": requestId, "Cache-Control": "no-store, max-age=0" } },
  );
}
