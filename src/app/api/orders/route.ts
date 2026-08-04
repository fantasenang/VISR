import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { reservationSchema } from "@/lib/commerce/order-schema";
import { haloVariants, products } from "@/lib/commerce/catalog";
import { getPreorderApiAccess } from "@/lib/commerce/preorder-server";
import {
  persistFreeShipping,
  rollbackPendingOrder,
} from "@/lib/commerce/free-shipping-persistence";
import {
  notesWithTrackingConsent,
  readTrackingConsentFromCookieHeader,
} from "@/lib/privacy/consent";
import { getChargeableWeightGrams, getPackingProfile } from "@/lib/shipping/packing";
import { calculateDomesticRates, searchDomesticDestinations } from "@/lib/shipping/rajaongkir";
import { elapsedMs, logger, requestIdFrom } from "@/lib/observability/logger";
import { apiError, normalizeErrorBody, readJsonBody } from "@/lib/http/api";

type ReservationResult = { order_id: string; order_number: string; expires_at: string };
type ShippingResult = { shipping_cost_idr: number; total_idr: number };
type ApiResult = { status: number; body: Record<string, unknown> };
type CachedReservation = { expiresAt: number; promise: Promise<ApiResult> };

const RESERVATION_CACHE_TTL_MS = 5 * 60 * 1000;
const reservationCache = new Map<string, CachedReservation>();

function failure(code: string, message: string, details?: unknown): Record<string, unknown> {
  return { error: { code, message, ...(details === undefined ? {} : { details }) } };
}

async function resolveOriginId() {
  const configured = Number(process.env.RAJAONGKIR_ORIGIN_ID);
  if (Number.isInteger(configured) && configured > 0) return configured;
  const matches = await searchDomesticDestinations("40291", 10);
  const exact = matches.find((destination) => destination.zipCode === "40291");
  if (!exact) throw new Error("RAJAONGKIR_ORIGIN_NOT_FOUND");
  return exact.id;
}

function cartFromItems(items: Array<{ sku: string; quantity: number }>) {
  let carryQty = 0;
  let haloQty = 0;
  let linkQty = 0;
  for (const item of items) {
    if (item.sku === products.carry.sku) carryQty += item.quantity;
    else if (item.sku === products.additionalLink.sku) linkQty += item.quantity;
    else if (haloVariants.some((variant) => variant.sku === item.sku)) haloQty += item.quantity;
  }
  return { carryQty, haloQty, linkQty };
}

function subtotalFromCart(cart: { carryQty: number; haloQty: number; linkQty: number }) {
  return (
    cart.carryQty * products.carry.price +
    cart.haloQty * products.halo.price +
    cart.linkQty * products.additionalLink.price
  );
}

function validationMessage(path: PropertyKey[], fallback: string) {
  const field = String(path[0] ?? "");
  if (field === "customer") {
    const customerField = String(path[1] ?? "");
    if (customerField === "address") return "Enter a complete street address of at least 10 characters.";
    if (customerField === "whatsapp") return "Enter WhatsApp in Indonesian format starting with 62.";
    if (customerField === "email") return "Enter a valid email address.";
    if (customerField === "fullName") return "Enter your full name.";
  }
  if (field === "shipping") return "The selected shipping service is no longer valid. Return to Edit Information and select it again.";
  return fallback || "Please check your order information and try again.";
}

function reservationFingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function pruneReservationCache(now: number) {
  for (const [key, entry] of reservationCache) if (entry.expiresAt <= now) reservationCache.delete(key);
}

async function createReservation(
  parsedData: typeof reservationSchema._output,
  requestId: string,
  trackingConsentGranted: boolean,
): Promise<ApiResult> {
  const startedAt = performance.now();
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    logger.error("ORDER_CONFIGURATION_ERROR", { requestId, hasSupabaseUrl: Boolean(supabaseUrl), hasServiceRoleKey: Boolean(serviceRoleKey) });
    return { status: 503, body: failure("COMMERCE_NOT_CONFIGURED", "Commerce service is not configured.") };
  }

  const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" };

  try {
    const cart = cartFromItems(parsedData.items);
    const orderSubtotalIdr = subtotalFromCart(cart);
    const profile = getPackingProfile(cart);
    const originId = await resolveOriginId();
    const selectedCourier = parsedData.shipping.courier;
    const weight = getChargeableWeightGrams(profile, selectedCourier);
    const ratesStartedAt = performance.now();
    const liveRates = await calculateDomesticRates({
      originId,
      destinationId: parsedData.shipping.destinationId,
      weightGrams: weight.chargeableWeightGrams,
      couriers: [selectedCourier],
      orderSubtotalIdr,
    });
    const shippingQuoteDurationMs = elapsedMs(ratesStartedAt);

    const liveRate = liveRates.find((rate) => rate.courierCode === selectedCourier && rate.service === parsedData.shipping.service);
    if (!liveRate) {
      logger.warn("ORDER_SHIPPING_SERVICE_UNAVAILABLE", { requestId, courier: selectedCourier, service: parsedData.shipping.service, destinationId: parsedData.shipping.destinationId, shippingQuoteDurationMs });
      return { status: 409, body: failure("SHIPPING_SERVICE_UNAVAILABLE", "The selected shipping service is no longer available.") };
    }
    if (liveRate.costIdr !== parsedData.shipping.quotedCostIdr) {
      logger.warn("ORDER_SHIPPING_RATE_CHANGED", { requestId, courier: selectedCourier, service: liveRate.service, quotedCostIdr: parsedData.shipping.quotedCostIdr, currentCostIdr: liveRate.costIdr, shippingQuoteDurationMs });
      return { status: 409, body: failure("SHIPPING_RATE_CHANGED", "The shipping rate has changed.", { currentCostIdr: liveRate.costIdr }) };
    }

    const reservationStartedAt = performance.now();
    const reservationResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/reserve_visr_order`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        customer: {
          ...parsedData.customer,
          notes: notesWithTrackingConsent(
            parsedData.customer.notes,
            trackingConsentGranted,
          ),
        },
        requested_items: parsedData.items,
      }),
      cache: "no-store",
    });
    const reservationDurationMs = elapsedMs(reservationStartedAt);

    if (!reservationResponse.ok) {
      const databaseFailure = await reservationResponse.json().catch(() => ({})) as Record<string, unknown>;
      const rawMessage = typeof databaseFailure.message === "string" ? databaseFailure.message : "ORDER_CREATION_FAILED";
      const normalized = rawMessage.toUpperCase();
      const status = normalized.includes("STOCK") ? 409 : normalized.includes("LIMIT") ? 400 : 500;
      const code = normalized.includes("STOCK") ? "INSUFFICIENT_STOCK" : normalized.includes("LIMIT") ? "ORDER_LIMIT_EXCEEDED" : "ORDER_CREATION_FAILED";
      logger.warn("ORDER_RESERVATION_REJECTED", { requestId, status, databaseStatus: reservationResponse.status, reason: rawMessage, reservationDurationMs, durationMs: elapsedMs(startedAt) });
      return { status, body: failure(code, rawMessage) };
    }

    const payload = (await reservationResponse.json()) as ReservationResult[] | ReservationResult;
    const reservation = Array.isArray(payload) ? payload[0] : payload;
    if (!reservation?.order_number || !reservation.order_id) {
      logger.error("ORDER_INVALID_RESERVATION_RESPONSE", { requestId, reservationDurationMs, durationMs: elapsedMs(startedAt) });
      return { status: 502, body: failure("INVALID_RESERVATION_RESPONSE", "The reservation service returned an invalid response.") };
    }

    const shippingStartedAt = performance.now();
    let shipping: ShippingResult | null = null;

    try {
      if (liveRate.costIdr === 0) {
        shipping = await persistFreeShipping({
          supabaseUrl,
          headers,
          orderId: reservation.order_id,
          courier: selectedCourier,
          service: liveRate.service,
          actualWeightGrams: profile.actualWeightGrams,
          boxCount: 1,
          lengthCm: profile.lengthCm,
          widthCm: profile.widthCm,
          heightCm: profile.heightCm,
        });
      } else {
        const shippingResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/apply_visr_shipping`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            p_order_id: reservation.order_id,
            p_courier: selectedCourier,
            p_service: liveRate.service,
            p_shipping_cost_idr: liveRate.costIdr,
            p_actual_weight_grams: profile.actualWeightGrams,
            p_box_count: 1,
            p_length_cm: profile.lengthCm,
            p_width_cm: profile.widthCm,
            p_height_cm: profile.heightCm,
          }),
          cache: "no-store",
        });

        if (!shippingResponse.ok) {
          const databaseFailure = await shippingResponse.json().catch(() => ({})) as Record<string, unknown>;
          throw new Error(`SHIPPING_RPC_FAILED:${shippingResponse.status}:${JSON.stringify(databaseFailure)}`);
        }

        const shippingPayload = (await shippingResponse.json()) as ShippingResult[] | ShippingResult;
        shipping = Array.isArray(shippingPayload) ? shippingPayload[0] : shippingPayload;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "SHIPPING_PERSISTENCE_FAILED";
      try {
        await rollbackPendingOrder(supabaseUrl, headers, reservation.order_id);
      } catch (rollbackError) {
        logger.error("ORDER_SHIPPING_ROLLBACK_FAILED", {
          requestId,
          orderId: reservation.order_id,
          orderNumber: reservation.order_number,
          message: rollbackError instanceof Error ? rollbackError.message : "ORDER_ROLLBACK_FAILED",
        });
      }

      logger.error("ORDER_SHIPPING_PERSISTENCE_FAILED", {
        requestId,
        orderId: reservation.order_id,
        orderNumber: reservation.order_number,
        shippingCostIdr: liveRate.costIdr,
        message,
        shippingPersistenceDurationMs: elapsedMs(shippingStartedAt),
        durationMs: elapsedMs(startedAt),
      });
      return { status: 502, body: failure("SHIPPING_PERSISTENCE_FAILED", "Shipping details could not be saved.") };
    }

    const shippingPersistenceDurationMs = elapsedMs(shippingStartedAt);
    if (!shipping) {
      try {
        await rollbackPendingOrder(supabaseUrl, headers, reservation.order_id);
      } catch {
        // The primary failure is logged below. Expired reservations are also released by cron.
      }
      logger.error("ORDER_INVALID_SHIPPING_RESPONSE", { requestId, orderId: reservation.order_id, orderNumber: reservation.order_number, durationMs: elapsedMs(startedAt) });
      return { status: 502, body: failure("INVALID_SHIPPING_RESPONSE", "The shipping service returned an invalid response.") };
    }

    logger.info("ORDER_RESERVATION_CREATED", {
      requestId,
      orderId: reservation.order_id,
      orderNumber: reservation.order_number,
      itemCount: parsedData.items.reduce((sum, item) => sum + item.quantity, 0),
      orderSubtotalIdr,
      courier: selectedCourier,
      service: liveRate.service,
      shippingCostIdr: shipping.shipping_cost_idr,
      totalIdr: shipping.total_idr,
      trackingConsentGranted,
      shippingQuoteDurationMs,
      reservationDurationMs,
      shippingPersistenceDurationMs,
      durationMs: elapsedMs(startedAt),
    });

    return {
      status: 201,
      body: {
        orderId: reservation.order_id,
        orderNumber: reservation.order_number,
        expiresAt: reservation.expires_at,
        shippingCostIdr: shipping.shipping_cost_idr,
        totalIdr: shipping.total_idr,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "ORDER_CREATION_FAILED";
    const status = message === "RAJAONGKIR_NOT_CONFIGURED" ? 503 : message === "RAJAONGKIR_RATE_LIMITED" ? 429 : 502;
    const code = message === "RAJAONGKIR_NOT_CONFIGURED" ? "SHIPPING_NOT_CONFIGURED" : message === "RAJAONGKIR_RATE_LIMITED" ? "SHIPPING_RATE_LIMITED" : "ORDER_CREATION_FAILED";
    logger.error("ORDER_RESERVATION_FAILED", { requestId, status, message, durationMs: elapsedMs(startedAt) });
    return { status, body: failure(code, message) };
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  const startedAt = performance.now();
  const preorderAccess = await getPreorderApiAccess();

  if (!preorderAccess.allowed) {
    const upcoming = preorderAccess.phase === "upcoming";
    const code = upcoming ? "PREORDER_NOT_OPEN" : "PREORDER_CLOSED";
    const message = upcoming
      ? "Batch 2 preorder has not opened yet."
      : "Batch 2 preorder is closed.";
    logger.warn("ORDER_PREORDER_WINDOW_REJECTED", {
      requestId,
      phase: preorderAccess.phase,
      durationMs: elapsedMs(startedAt),
    });
    return apiError(requestId, code, message, 409);
  }

  const body = await readJsonBody(request);
  if (!body.ok) {
    logger.warn("ORDER_INVALID_BODY", { requestId, code: body.code, durationMs: elapsedMs(startedAt) });
    return apiError(
      requestId,
      body.code,
      body.code === "PAYLOAD_TOO_LARGE" ? "Request body exceeds the 64 KB limit." : "Request body must contain valid JSON.",
      body.status,
    );
  }

  const parsed = reservationSchema.safeParse(body.value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    logger.warn("ORDER_VALIDATION_FAILED", { requestId, path: issue?.path, message: issue?.message, durationMs: elapsedMs(startedAt) });
    return apiError(
      requestId,
      "INVALID_ORDER",
      validationMessage(issue?.path ?? [], issue?.message ?? "Please check your order information and try again."),
      400,
      parsed.error.flatten(),
    );
  }

  const trackingConsentGranted =
    readTrackingConsentFromCookieHeader(request.headers.get("cookie")) === "granted";
  const now = Date.now();
  pruneReservationCache(now);
  const key = reservationFingerprint({
    order: parsed.data,
    trackingConsentGranted,
    preview: preorderAccess.preview,
  });
  const existing = reservationCache.get(key);
  const replayed = Boolean(existing);
  const promise = existing?.promise ?? createReservation(
    parsed.data,
    requestId,
    trackingConsentGranted,
  );

  if (!existing) {
    reservationCache.set(key, { expiresAt: now + RESERVATION_CACHE_TTL_MS, promise });
    void promise.then((result) => {
      if (result.status < 200 || result.status >= 300) reservationCache.delete(key);
    });
  }

  const result = await promise;
  if (replayed) {
    logger.info("ORDER_RESERVATION_REPLAYED", { requestId, status: result.status, orderId: result.body.orderId ?? null, orderNumber: result.body.orderNumber ?? null, durationMs: elapsedMs(startedAt) });
  }

  const responseBody = result.status >= 400
    ? normalizeErrorBody(requestId, result.body, "ORDER_REQUEST_FAILED", "The order request could not be completed.")
    : result.body;

  return NextResponse.json(responseBody, {
    status: result.status,
    headers: {
      "x-request-id": requestId,
      "Cache-Control": "no-store, max-age=0",
      ...(replayed ? { "Idempotency-Replayed": "true" } : {}),
    },
  });
}
