import type { Metadata } from "next";
import CheckoutClient from "./checkout-client";
import CheckoutPolish from "./checkout-polish";
import PreorderGate from "./preorder-gate";
import { haloVariants, products } from "@/lib/commerce/catalog";
import { isPreorderPreviewOverride } from "@/lib/commerce/preorder-server";

export const metadata: Metadata = {
  title: "Reserve Your VISR — Batch 2",
  description: "Build and review your VISR Batch 2 reservation.",
};

const checkoutProducts = {
  carry: {
    id: products.carry.id,
    name: products.carry.name,
    slug: products.carry.id,
    sku: products.carry.sku,
    price: products.carry.price,
    stock: products.carry.stock,
    variants: [],
  },
  halo: {
    id: products.halo.id,
    name: products.halo.name,
    slug: products.halo.id,
    price: products.halo.price,
    stock: haloVariants.reduce((total, variant) => total + variant.stock, 0),
    variants: haloVariants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      slug: variant.id,
      sku: variant.sku,
      price: products.halo.price,
      stock: variant.stock,
    })),
  },
  additionalLink: {
    id: products.additionalLink.id,
    name: products.additionalLink.name,
    slug: products.additionalLink.id,
    sku: products.additionalLink.sku,
    price: products.additionalLink.price,
    stock: products.additionalLink.stock,
    variants: [],
  },
};

export default function CheckoutPage() {
  return (
    <PreorderGate forceOpen={isPreorderPreviewOverride()}>
      <CheckoutClient products={checkoutProducts} />
      <CheckoutPolish />
    </PreorderGate>
  );
}
