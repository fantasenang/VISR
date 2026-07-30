import { NextResponse } from "next/server";
import { z } from "zod";
import { getChargeableWeightGrams, getPackingProfile } from "@/lib/shipping/packing";
import { calculateDomesticRates, searchDomesticDestinations } from "@/lib/shipping/rajaongkir";

const requestSchema = z.object({
  destinationId: z.coerce.number().int().positive(),
  cart: z.object({
    carryQty: z.coerce.number().int().min(0).max(3),
    haloQty: z.coerce.number().int().min(0).max(6),
    linkQty: z.coerce.number().int().min(0).max(5),
  }),
});

const allowedServices: Record<"jne" | "jnt", Set<string>> = {
  jne: new Set(["REG", "YES"]),
  jnt: new Set(["REG", "NDD"]),
};

async function resolveOriginId() {
  const configured = Number(process.env.RAJAONGKIR_ORIGIN_ID);
  if (Number.isInteger(configured) && configured > 0) return configured;

  const matches = await searchDomesticDestinations("40291", 10);
  const exact = matches.find((destination) => destination.zipCode === "40291");
  if (!exact) throw new Error("RAJAONGKIR_ORIGIN_NOT_FOUND");
  return exact.id;
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_SHIPPING_REQUEST", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const profile = getPackingProfile(parsed.data.cart);
    const originId = await resolveOriginId();
    const jneWeight = getChargeableWeightGrams(profile, "jne");
    const jntWeight = getChargeableWeightGrams(profile, "jnt");

    const [jneRates, jntRates] = await Promise.all([
      calculateDomesticRates({
        originId,
        destinationId: parsed.data.destinationId,
        weightGrams: jneWeight.chargeableWeightGrams,
        couriers: ["jne"],
      }),
      calculateDomesticRates({
        originId,
        destinationId: parsed.data.destinationId,
        weightGrams: jntWeight.chargeableWeightGrams,
        couriers: ["jnt"],
      }),
    ]);

    const rates = [...jneRates, ...jntRates]
      .filter((rate) => {
        const courier = rate.courierCode as "jne" | "jnt";
        return courier in allowedServices && allowedServices[courier].has(rate.service);
      })
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
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "SHIPPING_RATE_FAILED";
    const status = message === "RAJAONGKIR_NOT_CONFIGURED" ? 503 : message === "RAJAONGKIR_RATE_LIMITED" ? 429 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
