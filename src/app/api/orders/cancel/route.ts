import { NextResponse } from "next/server";
import { z } from "zod";
import { cancelPendingVisrOrder } from "@/lib/commerce/reservations";
import { reconcileInventoryCounters } from "@/lib/commerce/inventory-reconciliation";
import { elapsedMs, logger, requestIdFrom } from "@/lib/observability/logger";

const requestSchema = z.object({
  orderId: z.string().uuid(),
  orderNumber: z.string().trim().toUpperCase().regex(/^VISR\.B\d{2}\.\d{8}\.\d{3,}$/),
  contact: z.string().trim().min(5).max(254),
});

type OrderRow = {
  id: string;
  order_number: string;
  email: string;
  whatsapp: string;
  payment_status: string;
};

type PaymentRow = {
  provider: string;
  provider_transaction_id: string | null;
  provider_status: string | null;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
}

function contactMatches(order: OrderRow, contact: string) {
  return normalizeEmail(order.email) === normalizeEmail(contact) ||
    normalizePhone(order.whatsapp) === normalizePhone(contact);
}

function headers(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

function paymentHasStarted(payment: PaymentRow) {
  const providerStatus = payment.provider_status?.toLowerCase() ?? "";
  return Boolean(payment.provider_transaction_id) ||
    ["pending", "capture", "settlement", "claimed", "manual_verified"].includes(providerStatus);
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  const requestId = requestIdFrom(request);
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  const responseHeaders = {
    "x-request-id": requestId,
    "Cache-Control": "no-store, max-age=0",
  };

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "INVALID_CANCELLATION_REQUEST", message: "Reservation could not be cancelled." } },
      { status: 400, headers: responseHeaders },
    );
  }

  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: { code: "COMMERCE_NOT_CONFIGURED", message: "Reservation service is unavailable." } },
      { status: 503, headers: responseHeaders },
    );
  }

  const { orderId, orderNumber, contact } = parsed.data;
  const [orderResponse, paymentResponse] = await Promise.all([
    fetch(
      `${supabaseUrl}/rest/v1/orders?select=id,order_number,email,whatsapp,payment_status&id=eq.${encodeURIComponent(orderId)}&order_number=eq.${encodeURIComponent(orderNumber)}&limit=1`,
      { headers: headers(serviceRoleKey), cache: "no-store" },
    ),
    fetch(
      `${supabaseUrl}/rest/v1/payments?select=provider,provider_transaction_id,provider_status&order_id=eq.${encodeURIComponent(orderId)}`,
      { headers: headers(serviceRoleKey), cache: "no-store" },
    ),
  ]);

  if (!orderResponse.ok || !paymentResponse.ok) {
    logger.error("CUSTOMER_RESERVATION_CANCEL_LOOKUP_FAILED", {
      requestId,
      orderId,
      orderNumber,
      orderStatus: orderResponse.status,
      paymentStatus: paymentResponse.status,
      durationMs: elapsedMs(startedAt),
    });
    return NextResponse.json(
      { error: { code: "CANCELLATION_LOOKUP_FAILED", message: "Reservation could not be cancelled." } },
      { status: 502, headers: responseHeaders },
    );
  }

  const order = ((await orderResponse.json()) as OrderRow[])[0];
  const payments = (await paymentResponse.json()) as PaymentRow[];
  if (!order || !contactMatches(order, contact)) {
    return NextResponse.json(
      { error: { code: "ORDER_NOT_FOUND", message: "Reservation could not be verified." } },
      { status: 404, headers: responseHeaders },
    );
  }

  if (order.payment_status !== "pending") {
    return NextResponse.json(
      { error: { code: "ORDER_NOT_PENDING", message: "This reservation can no longer be cancelled." } },
      { status: 409, headers: responseHeaders },
    );
  }

  const startedPayment = payments.find(paymentHasStarted);
  if (startedPayment) {
    logger.info("CUSTOMER_RESERVATION_CANCEL_SKIPPED_PAYMENT_STARTED", {
      requestId,
      orderId,
      orderNumber,
      provider: startedPayment.provider,
      providerStatus: startedPayment.provider_status?.toLowerCase() || null,
      durationMs: elapsedMs(startedAt),
    });
    return NextResponse.json(
      {
        cancelled: false,
        paymentStarted: true,
        message: "Payment instructions are already active, so the reservation remains held.",
      },
      { status: 409, headers: responseHeaders },
    );
  }

  try {
    const result = await cancelPendingVisrOrder(order.id);
    await reconcileInventoryCounters({ force: true, minimumIntervalMs: 0 });
    logger.info("CUSTOMER_RESERVATION_CANCELLED", {
      requestId,
      orderId,
      orderNumber,
      releasedReservations: result.releasedReservations,
      durationMs: elapsedMs(startedAt),
    });
    return NextResponse.json(
      { cancelled: true, orderNumber, releasedReservations: result.releasedReservations },
      { headers: responseHeaders },
    );
  } catch (error) {
    logger.error("CUSTOMER_RESERVATION_CANCEL_FAILED", {
      requestId,
      orderId,
      orderNumber,
      message: error instanceof Error ? error.message : "UNKNOWN_ERROR",
      durationMs: elapsedMs(startedAt),
    });
    return NextResponse.json(
      { error: { code: "CANCELLATION_FAILED", message: "Reservation could not be cancelled." } },
      { status: 502, headers: responseHeaders },
    );
  }
}
