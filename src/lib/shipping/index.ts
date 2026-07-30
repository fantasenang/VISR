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
