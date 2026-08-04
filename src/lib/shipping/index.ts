import { formatRupiah } from "@/lib/commerce/catalog";
import { getPackingProfile } from "./packing";

export const SHIPPING_DISCOUNT_CAP_IDR = 20_000;
export const SHIPPING_DISCOUNT_MINIMUM_SUBTOTAL_IDR = 200_000;

export type CheckoutCourier = "jne" | "jnt";

export type ShippingDestination = {
  id: number;
  label: string;
  provinceName: string;
  cityName: string;
  districtName: string;
  subdistrictName: string;
  zipCode: string;
};

export type ShippingRate = {
  id?: string;
  courier: CheckoutCourier;
  courierName?: string;
  service: string;
  description?: string;
  costIdr: number;
  etd?: string;
};

export function calculateShippingDiscount(quotedCostIdr: number, orderSubtotalIdr: number) {
  const normalizedCostIdr = Number.isFinite(quotedCostIdr)
    ? Math.max(0, Math.round(quotedCostIdr))
    : 0;
  const normalizedSubtotalIdr = Number.isFinite(orderSubtotalIdr)
    ? Math.max(0, Math.round(orderSubtotalIdr))
    : 0;
  const eligible = normalizedSubtotalIdr >= SHIPPING_DISCOUNT_MINIMUM_SUBTOTAL_IDR;
  const discountIdr = eligible
    ? Math.min(normalizedCostIdr, SHIPPING_DISCOUNT_CAP_IDR)
    : 0;

  return {
    quotedCostIdr: normalizedCostIdr,
    orderSubtotalIdr: normalizedSubtotalIdr,
    eligible,
    discountIdr,
    payableCostIdr: normalizedCostIdr - discountIdr,
  };
}

export function calculatePacking(input: {
  carryQty: number;
  haloQty: number;
  additionalLinkQty: number;
}) {
  if (input.carryQty + input.haloQty + input.additionalLinkQty === 0) {
    return {
      carryQty: 0,
      haloQty: 0,
      linkQty: 0,
      lengthCm: 0,
      widthCm: 0,
      heightCm: 0,
      actualWeightGrams: 0,
      volumeCm3: 0,
    };
  }

  return getPackingProfile({
    carryQty: input.carryQty,
    haloQty: input.haloQty,
    linkQty: input.additionalLinkQty,
  });
}

export function courierLabel(rate: ShippingRate) {
  const courierName = rate.courierName || (rate.courier === "jne" ? "JNE" : "J&T Express");
  return `${courierName} ${rate.service}`.trim();
}

export { formatRupiah };
