import { NextResponse } from "next/server";
import { z } from "zod";
import { products } from "@/lib/commerce/catalog";
import { getChargeableWeightGrams, getPackingProfile } from "@/lib/shipping/packing";
import { calculateDomesticRates, searchDomesticDestinations, type RajaOngkirRate } from "@/lib/shipping/rajaongkir";
import { elapsedMs, logger, requestIdFrom } from "@/lib/observability/logger";

const requestSchema = z.object({
  destinationId: z.coerce.number().int().positive(),
  cart: z.object({
    carryQty: z.coerce.number().int().min(0).max(3),
    haloQty: z.coerce.number().int().min(0).max(6),
    linkQty: z.coerce.number().int().min(0).max(5),
  }),
});

const supportedCouriers = new Set(["jne", "jnt"]);

function apiError(requestId: string, code: string, message: string, status: number, details?: unknown) {
  return NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}) }, requestId },
    { status, headers: { "x-request-id": requestId, "Cache-Control": "no-store, max-age=0" } },
  );
}

async function resolveOriginId() {
  const configured = Number(process.env.RAJAONGKIR_ORIGIN_ID);
  if (Number.isInteger(configured) && configured > 0) return configured;

  const matches = await searchDomesticDestinations("40921", 10);
  const exact = matches.find(
    (destination) =>
      destination.zipCode === "40921" &&
      destination.subdistrictName.toUpperCase() === "SUKAMUKTI",
  );
  if (!exact) throw new Error("RAJAONGKIR_ORIGIN_NOT_FOUND");
  return exact.id;
}

function selectPreferredServices(rates: RajaOngkirRate[], preferredServices: string[]) {
  const validRates = rates
    .filter((rate) => Number.isFinite(rate.costIdr) && rate.costIdr >= 0)
    .sort((a, b) => a.costIdr - b.costIdr);

  if (!validRates.length) return [];

  const preferred = preferredServices
    .map((service) => validRates.find((rate) => rate.service === service))
    .filter((rate): rate is RajaOngkirRate => Boolean(rate));

  return preferred.length > 0 ? preferred : [validRates[0]];
}

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  const startedAt = performance.now();
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    logger.warn("SHIPPING_RATE_VALIDATION_FAILED", {
      requestId,
      issues: parsed.error.issues.map((issue) => issue.path.join(".")),
      durationMs: elapsedMs(startedAt),
    });
    return apiError(requestId, "INVALID_SHIPPING_REQUEST", "The shipping request is invalid.", 400, parsed.error.flatten());
  }

  try {
    const profile = getPackingProfile(parsed.data.cart);
    const orderSubtotalIdr =
      parsed.data.cart.carryQty * products.carry.price +
      parsed.data.cart.haloQty * products.halo.price +
      parsed.data.cart.linkQty * products.additionalLink.price;
    const originId = await resolveOriginId();
    const jneWeight = getChargeableWeightGrams(profile, "jne");
    const jntWeight = getChargeableWeightGrams(profile, "jnt");

    const [jneRates, jntRates] = await Promise.all([
      calculateDomesticRates({
        originId,
        destinationId: parsed.data.destinationId,
        weightGrams: jneWeight.chargeableWeightGrams,
        couriers: ["jne"],
        orderSubtotalIdr,
      }),
      calculateDomesticRates({
        originId,
        destinationId: parsed.data.destinationId,
        weightGrams: jntWeight.chargeableWeightGrams,
        couriers: ["jnt"],
        orderSubtotalIdr,
      }),
    ]);

    const filteredRates = [
      ...selectPreferredServices(jneRates, ["REG", "YES"]),
      ...selectPreferredServices(jntRates, ["EZ", "NDD"]),
    ];

    const rates = filteredRates
      .filter((rate) => supportedCouriers.has(rate.courierCode))
      .map((rate) => ({
        id: `${rate.courierCode}:${rate.service}`,
        courier: rate.courierCode,
        courierName: rate.courierName,
        service: rate.service,
        description: rate.description,
        costIdr: rate.costIdr,
        etd: rate.etd,
      }))
      .sort((a, b) => a.costIdr - b.costIdr);

    logger.info("SHIPPING_RATES_CALCULATED", {
      requestId,
      destinationId: parsed.data.destinationId,
      orderSubtotalIdr,
      resultCount: rates.length,
      durationMs: elapsedMs(startedAt),
    });

    return NextResponse.json(
      {
        rates,
        package: {
          lengthCm: profile.lengthCm,
          widthCm: profile.widthCm,
          heightCm: profile.heightCm,
          actualWeightGrams: profile.actualWeightGrams,
          jneChargeableWeightGrams: jneWeight.chargeableWeightGrams,
          jntChargeableWeightGrams: jntWeight.chargeableWeightGrams,
        },
        requestId,
      },
      { headers: { "x-request-id": requestId, "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    const code = error instanceof Error ? error.message : "SHIPPING_RATE_FAILED";
    const status = code === "RAJAONGKIR_NOT_CONFIGURED" ? 503 : code === "RAJAONGKIR_RATE_LIMITED" ? 429 : 502;
    logger.error("SHIPPING_RATE_FAILED", {
      requestId,
      code,
      status,
      destinationId: parsed.data.destinationId,
      durationMs: elapsedMs(startedAt),
    });
    return apiError(requestId, code, "Shipping rates are temporarily unavailable.", status);
  }
}
