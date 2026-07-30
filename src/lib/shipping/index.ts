import { formatRupiah } from "@/lib/commerce/catalog";
import { getPackingProfile } from "./packing";

export type CheckoutCourier = "jne" | "jnt";

export type ShippingDestination = {
  id: number;
  label: string;
  province: string;
  city: string;
  district?: string;
  postalCode?: string;
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

export function calculatePacking(input: {
  carryQty: number;
  haloQty: number;
  additionalLinkQty: number;
}) {
  const carryQty = Math.max(0, Math.floor(input.carryQty || 0));
  const haloQty = Math.max(0, Math.floor(input.haloQty || 0));
  const linkQty = Math.max(0, Math.floor(input.additionalLinkQty || 0));

  if (carryQty + haloQty + linkQty === 0) {
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

  return getPackingProfile({ carryQty, haloQty, linkQty });
}

export function courierLabel(rate: ShippingRate) {
  const courierName = rate.courierName || (rate.courier === "jne" ? "JNE" : "J&T Express");
  return `${courierName} ${rate.service}`.trim();
}

export { formatRupiah };
