import type { Metadata } from "next";
import { MobileOnlyPage } from "@/components/layout/mobile-only-page";
import CheckoutApiErrorNormalizer from "./checkout-api-error-normalizer";
import CheckoutAvailabilityGuard from "./checkout-availability-guard";
import CheckoutClient from "./checkout-client";
import { CheckoutOrderAccessBridge } from "./checkout-order-access-bridge";
import CheckoutPolish from "./checkout-polish";
import CheckoutViewportGuard from "./checkout-viewport-guard";
import OrderNumberSavePrompt from "./order-number-save-prompt";
import PaymentResultRedirect from "./payment-result-redirect";
import PreorderGate from "./preorder-gate";
import QrisPaymentOverride from "./qris-payment-override";
import { getLiveCatalog } from "@/lib/commerce/catalog-server";
import { isPreorderPreviewOverride } from "@/lib/commerce/preorder-server";
import {
  formatRupiah,
  SHIPPING_DISCOUNT_CAP_IDR,
  SHIPPING_DISCOUNT_MINIMUM_SUBTOTAL_IDR,
} from "@/lib/shipping";

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
        <CheckoutViewportGuard />
        <PaymentResultRedirect />
        <CheckoutApiErrorNormalizer />
        <CheckoutOrderAccessBridge />
        <QrisPaymentOverride />
        <OrderNumberSavePrompt />
        <div className="border-b border-white/[0.08] bg-[#050505] px-6 pt-8 text-white md:px-12">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-[1.75rem] border border-white/15 bg-white/[0.055]">
            <div className="grid gap-5 px-6 py-6 sm:grid-cols-[1fr_auto] sm:items-center md:px-8">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-white/20 bg-white px-3 py-1 text-[9px] font-medium uppercase tracking-[0.18em] text-black">
                    Automatically applied
                  </span>
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/42">
                    Batch 2 shipping benefit
                  </p>
                </div>
                <h2 className="mt-4 text-2xl tracking-[-0.035em] sm:text-3xl">
                  Free shipping up to {formatRupiah(SHIPPING_DISCOUNT_CAP_IDR)}.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/58">
                  Active automatically for product subtotals of at least {formatRupiah(SHIPPING_DISCOUNT_MINIMUM_SUBTOTAL_IDR)}. VISR covers the first {formatRupiah(SHIPPING_DISCOUNT_CAP_IDR)} of domestic shipping; no code is required.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:min-w-[240px]">
                <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                  <p className="text-[9px] uppercase tracking-[0.15em] text-white/35">Minimum order</p>
                  <p className="mt-2 text-sm text-white">{formatRupiah(SHIPPING_DISCOUNT_MINIMUM_SUBTOTAL_IDR)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3">
                  <p className="text-[9px] uppercase tracking-[0.15em] text-white/35">Maximum benefit</p>
                  <p className="mt-2 text-sm text-white">{formatRupiah(SHIPPING_DISCOUNT_CAP_IDR)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <CheckoutClient products={checkoutProducts} />
        <CheckoutPolish />
        <CheckoutAvailabilityGuard />
      </PreorderGate>
    </MobileOnlyPage>
  );
}
