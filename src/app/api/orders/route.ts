import { NextResponse } from "next/server";
import { reservationSchema } from "@/lib/commerce/order-schema";
import { haloVariants, products } from "@/lib/commerce/catalog";
import { getChargeableWeightGrams, getPackingProfile } from "@/lib/shipping/packing";
import { calculateDomesticRates, searchDomesticDestinations } from "@/lib/shipping/rajaongkir";

type ReservationResult = {
  order_id: string;
  order_number: string;
  expires_at: string;
};

type ShippingResult = {
  shipping_cost_idr: number;
  total_idr: number;
};

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

export async function POST(request: Request) {
  const parsed = reservationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    console.warn("INVALID_ORDER_VALIDATION", {
      path: issue?.path,
      message: issue?.message,
    });
    return NextResponse.json(
      {
        error: validationMessage(issue?.path ?? [], issue?.message ?? "Please check your order information and try again."),
        code: "INVALID_ORDER",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return NextResponse.json({ error: "COMMERCE_NOT_CONFIGURED" }, { status: 503 });

  const headers = { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" };

  try {
    const cart = cartFromItems(parsed.data.items);
    const profile = getPackingProfile(cart);
    const originId = await resolveOriginId();
    const selectedCourier = parsed.data.shipping.courier;
    const weight = getChargeableWeightGrams(profile, selectedCourier);
    const liveRates = await calculateDomesticRates({
      originId,
      destinationId: parsed.data.shipping.destinationId,
      weightGrams: weight.chargeableWeightGrams,
      couriers: [selectedCourier],
    });

    const liveRate = liveRates.find((rate) => rate.courierCode === selectedCourier && rate.service === parsed.data.shipping.service);
    if (!liveRate) return NextResponse.json({ error: "SHIPPING_SERVICE_UNAVAILABLE" }, { status: 409 });
    if (liveRate.costIdr !== parsed.data.shipping.quotedCostIdr) {
      return NextResponse.json({ error: "SHIPPING_RATE_CHANGED", currentCostIdr: liveRate.costIdr }, { status: 409 });
    }

    const reservationResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/reserve_visr_order`, {
      method: "POST",
      headers,
      body: JSON.stringify({ customer: parsed.data.customer, requested_items: parsed.data.items }),
      cache: "no-store",
    });

    if (!reservationResponse.ok) {
      const failure = await reservationResponse.json().catch(() => ({}));
      const message = typeof failure.message === "string" ? failure.message : "ORDER_CREATION_FAILED";
      const normalized = message.toUpperCase();
      return NextResponse.json({ error: message }, { status: normalized.includes("STOCK") ? 409 : normalized.includes("LIMIT") ? 400 : 500 });
    }

    const payload = (await reservationResponse.json()) as ReservationResult[] | ReservationResult;
    const reservation = Array.isArray(payload) ? payload[0] : payload;
    if (!reservation?.order_number || !reservation.order_id) return NextResponse.json({ error: "INVALID_RESERVATION_RESPONSE" }, { status: 502 });

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
      const failure = await shippingResponse.json().catch(() => ({}));
      return NextResponse.json({ error: "SHIPPING_PERSISTENCE_FAILED", details: failure }, { status: 502 });
    }

    const shippingPayload = (await shippingResponse.json()) as ShippingResult[] | ShippingResult;
    const shipping = Array.isArray(shippingPayload) ? shippingPayload[0] : shippingPayload;
    if (!shipping) return NextResponse.json({ error: "INVALID_SHIPPING_RESPONSE" }, { status: 502 });

    return NextResponse.json({
      orderId: reservation.order_id,
      orderNumber: reservation.order_number,
      expiresAt: reservation.expires_at,
      shippingCostIdr: shipping.shipping_cost_idr,
      totalIdr: shipping.total_idr,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ORDER_CREATION_FAILED";
    const status = message === "RAJAONGKIR_NOT_CONFIGURED" ? 503 : message === "RAJAONGKIR_RATE_LIMITED" ? 429 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
