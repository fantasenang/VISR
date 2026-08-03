import { NextResponse } from "next/server";
import { z } from "zod";
import { buildPaymentReceiptPdf } from "@/lib/commerce/receipt-pdf";
import { apiError, readJsonBody } from "@/lib/http/api";
import { elapsedMs, logger, requestIdFrom } from "@/lib/observability/logger";

export const runtime = "nodejs";

const requestSchema = z.object({
  orderNumber: z.string().trim().toUpperCase().regex(/^VISR\.B\d{2}\.\d{8}\.\d{3,}$/),
  contact: z.string().trim().min(5).max(254),
});

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
  subtotal_idr: number;
  shipping_cost_idr: number;
  total_idr: number;
  payment_status: string;
  paid_at: string | null;
  created_at: string;
};

type OrderItemRow = {
  product_name: string;
  variant_name: string | null;
  quantity: number;
  line_total_idr: number;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
}

function contactMatches(order: OrderRow, contact: string) {
  return (
    normalizeEmail(order.email) === normalizeEmail(contact) ||
    normalizePhone(order.whatsapp) === normalizePhone(contact)
  );
}

function databaseHeaders(serviceRoleKey: string) {
  return { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` };
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  const startedAt = performance.now();
  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(
      requestId,
      body.code,
      body.code === "PAYLOAD_TOO_LARGE"
        ? "Request body exceeds the 64 KB limit."
        : "Request body must contain valid JSON.",
      body.status,
    );
  }

  const parsed = requestSchema.safeParse(body.value);
  if (!parsed.success) {
    logger.warn("ORDER_RECEIPT_INVALID_REQUEST", {
      requestId,
      durationMs: elapsedMs(startedAt),
    });
    return apiError(requestId, "ORDER_NOT_FOUND", "The order could not be verified.", 404);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    logger.error("ORDER_RECEIPT_CONFIGURATION_ERROR", {
      requestId,
      durationMs: elapsedMs(startedAt),
    });
    return apiError(requestId, "COMMERCE_NOT_CONFIGURED", "Receipt service is unavailable.", 503);
  }

  const headers = databaseHeaders(serviceRoleKey);
  const orderQuery = new URL(`${supabaseUrl}/rest/v1/orders`);
  orderQuery.searchParams.set(
    "select",
    "id,order_number,customer_name,email,whatsapp,address_line,province,city,postal_code,subtotal_idr,shipping_cost_idr,total_idr,payment_status,paid_at,created_at",
  );
  orderQuery.searchParams.set("order_number", `eq.${parsed.data.orderNumber}`);
  orderQuery.searchParams.set("limit", "1");

  const orderResponse = await fetch(orderQuery, { headers, cache: "no-store" });
  if (!orderResponse.ok) {
    logger.error("ORDER_RECEIPT_LOOKUP_FAILED", {
      requestId,
      databaseStatus: orderResponse.status,
      durationMs: elapsedMs(startedAt),
    });
    return apiError(requestId, "RECEIPT_LOOKUP_FAILED", "Receipt could not be prepared.", 502);
  }

  const orders = (await orderResponse.json()) as OrderRow[];
  const order = orders[0];
  if (!order || !contactMatches(order, parsed.data.contact)) {
    logger.warn("ORDER_RECEIPT_ACCESS_REJECTED", {
      requestId,
      orderNumber: parsed.data.orderNumber,
      durationMs: elapsedMs(startedAt),
    });
    return apiError(requestId, "ORDER_NOT_FOUND", "The order could not be verified.", 404);
  }

  if (order.payment_status !== "paid") {
    logger.info("ORDER_RECEIPT_NOT_READY", {
      requestId,
      orderNumber: order.order_number,
      paymentStatus: order.payment_status,
      durationMs: elapsedMs(startedAt),
    });
    return apiError(
      requestId,
      "RECEIPT_NOT_AVAILABLE",
      "The receipt becomes available after payment is verified.",
      409,
    );
  }

  const itemsQuery = new URL(`${supabaseUrl}/rest/v1/order_items`);
  itemsQuery.searchParams.set(
    "select",
    "product_name,variant_name,quantity,line_total_idr",
  );
  itemsQuery.searchParams.set("order_id", `eq.${order.id}`);
  itemsQuery.searchParams.set("order", "created_at.asc");

  const itemsResponse = await fetch(itemsQuery, { headers, cache: "no-store" });
  if (!itemsResponse.ok) {
    logger.error("ORDER_RECEIPT_ITEMS_FAILED", {
      requestId,
      orderNumber: order.order_number,
      databaseStatus: itemsResponse.status,
      durationMs: elapsedMs(startedAt),
    });
    return apiError(requestId, "RECEIPT_ITEMS_FAILED", "Receipt could not be prepared.", 502);
  }

  const items = (await itemsResponse.json()) as OrderItemRow[];
  if (items.length === 0) {
    return apiError(requestId, "RECEIPT_ITEMS_EMPTY", "Receipt could not be prepared.", 502);
  }

  const pdf = buildPaymentReceiptPdf({
    orderNumber: order.order_number,
    customerName: order.customer_name,
    email: order.email,
    whatsapp: order.whatsapp,
    address: order.address_line,
    city: order.city,
    province: order.province,
    postalCode: order.postal_code,
    subtotalIdr: order.subtotal_idr,
    shippingCostIdr: order.shipping_cost_idr,
    totalIdr: order.total_idr,
    paidAt: order.paid_at ?? order.created_at,
    items: items.map((item) => ({
      name: item.product_name,
      variant: item.variant_name,
      quantity: item.quantity,
      lineTotalIdr: item.line_total_idr,
    })),
  });

  const filename = `VISR-Receipt-${order.order_number.replace(/[^A-Z0-9.-]/gi, "-")}.pdf`;
  logger.info("ORDER_RECEIPT_DOWNLOADED", {
    requestId,
    orderId: order.id,
    orderNumber: order.order_number,
    itemCount: items.length,
    durationMs: elapsedMs(startedAt),
  });

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "x-request-id": requestId,
    },
  });
}
