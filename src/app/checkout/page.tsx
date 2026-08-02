import type { Metadata } from "next";
import { MobileOnlyPage } from "@/components/layout/mobile-only-page";
import CheckoutClient from "./checkout-client";
import CheckoutPolish from "./checkout-polish";
import PreorderGate from "./preorder-gate";
import { getLiveCatalog } from "@/lib/commerce/catalog-server";
import { isPreorderPreviewOverride } from "@/lib/commerce/preorder-server";
import { formatRupiah, SHIPPING_DISCOUNT_CAP_IDR } from "@/lib/shipping";

export const metadata: Metadata = {
  title: "Reserve Your VISR — Batch 2",
  description: "Build and review your VISR Batch 2 reservation.",
};

export default async function CheckoutPage() {
  const [catalog, previewOpen] = await Promise.all([
    getLiveCatalog(),
    isPreorderPreviewOverride(),
  ]);

  const checkoutProducts = {
    carry: {
      id: catalog.carry.id,
      name: catalog.carry.name,
      slug: catalog.carry.id,
      sku: catalog.carry.sku,
      price: catalog.carry.price,
      stock: catalog.carry.stock,
      variants: [],
    },
    halo: {
      id: catalog.halo.id,
      name: catalog.halo.name,
      slug: catalog.halo.id,
      price: catalog.halo.variants[0]?.price ?? catalog.halo.price,
      stock: catalog.halo.variants.reduce((total, variant) => total + variant.stock, 0),
      variants: catalog.halo.variants
        .filter((variant) => variant.isActive)
        .map((variant) => ({
          id: variant.id,
          name: variant.name,
          slug: variant.id,
          sku: variant.sku,
          price: variant.price,
          stock: variant.stock,
        })),
    },
    additionalLink: {
      id: catalog.additionalLink.id,
      name: catalog.additionalLink.name,
      slug: catalog.additionalLink.id,
      sku: catalog.additionalLink.sku,
      price: catalog.additionalLink.price,
      stock: catalog.additionalLink.stock,
      variants: [],
    },
  };

  return (
    <MobileOnlyPage>
      <PreorderGate forceOpen={previewOpen}>
        <div className="border-b border-white/[0.07] bg-[#050505] px-6 pt-8 text-white md:px-12">
          <div className="mx-auto max-w-7xl rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-4">
            <p className="text-[10px] uppercase tracking-[0.17em] text-white/38">Automatic shipping support</p>
            <p className="mt-2 text-sm leading-6 text-white/68">
              VISR covers up to {formatRupiah(SHIPPING_DISCOUNT_CAP_IDR)} of domestic shipping on every checkout. Shipping below the limit becomes free; only the remaining amount is charged.
            </p>
          </div>
        </div>
        <CheckoutClient products={checkoutProducts} />
        <CheckoutPolish />
      </PreorderGate>
    </MobileOnlyPage>
  );
}
