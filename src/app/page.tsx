import { VisrFaq } from "@/components/content/visr-faq";
import { LinkStockStatus } from "@/components/commerce/link-stock-status";
import { PreorderCta } from "@/components/commerce/preorder-cta";
import { PreorderSummary } from "@/components/commerce/preorder-summary";
import { MobileOnlyPage } from "@/components/layout/mobile-only-page";
import { SiteNavigation } from "@/components/navigation/site-navigation";
import { PrivacyChoicesButton } from "@/components/privacy/privacy-choices-button";
import { CarryPhase16 } from "@/experience/carry-phase-16/carry-phase-16";
import { HaloCollection } from "@/experience/halo-collection-revised";
import { LinkSystem } from "@/experience/link-system/link-system";
import { OpeningSequence } from "@/experience/opening/opening-sequence";
import { formatRupiah } from "@/lib/commerce/catalog";
import { getLiveCatalog } from "@/lib/commerce/catalog-server";
import { isPreorderPreviewOverride } from "@/lib/commerce/preorder-server";

const footerLinkClass =
  "w-fit text-sm text-white/48 transition-colors duration-300 hover:text-white";

export default async function HomePage() {
  const previewOpen = await isPreorderPreviewOverride();
  const catalog = await getLiveCatalog();

  return (
    <MobileOnlyPage>
      <main>
        <SiteNavigation preorderPrice={catalog.carry.price} />
        <OpeningSequence />
        <PreorderSummary
          price={catalog.carry.price}
          stock={catalog.carry.stock}
          forceOpen={previewOpen}
        />
        <LinkSystem />

        <section id="visr" className="py-28 md:py-48">
          <div className="visr-container grid gap-12 md:grid-cols-12">
            <p className="visr-label text-white/38 md:col-span-3">VISR Philosophy</p>
            <div className="md:col-span-8 md:col-start-5">
              <h2 className="visr-display">The collection is always the hero.</h2>
              <p className="visr-copy mt-9">
                VISR is a display system created around the collection—not the frame. Light reveals the material, precision protects the object, and every interaction returns attention to what matters.
              </p>
            </div>
          </div>
        </section>

        <CarryPhase16 />
        <HaloCollection />

        <section id="preorder-details" className="border-t border-white/[0.07] py-24 md:py-36">
          <div className="visr-container">
            <div className="grid gap-14 md:grid-cols-12">
              <div className="md:col-span-4">
                <p className="visr-label text-white/42">Batch 2 Preorder</p>
                <h2 className="mt-6 text-[clamp(2.7rem,5vw,5.8rem)] font-normal leading-[0.96] tracking-[-0.05em]">
                  Prepared during the preorder window.
                </h2>
              </div>

              <div className="space-y-10 md:col-span-7 md:col-start-6">
                <div className="grid gap-7 border-b border-white/10 pb-10 sm:grid-cols-3">
                  <div>
                    <p className="visr-label text-white/35">Preorder Opens</p>
                    <p className="mt-3 text-2xl">7 August 2026</p>
                  </div>
                  <div>
                    <p className="visr-label text-white/35">Preorder Closes</p>
                    <p className="mt-3 text-2xl">13 August · 23.59 WIB</p>
                  </div>
                  <div>
                    <p className="visr-label text-white/35">Estimated Dispatch</p>
                    <p className="mt-3 text-2xl">18–25 August 2026</p>
                  </div>
                </div>

                <p className="max-w-2xl text-base leading-7 text-white/55">
                  Preorder may close earlier when all 100 units are reserved. Production runs progressively before and throughout the preorder period, and finished units are dispatched in order sequence after passing final inspection.
                </p>

                <div className="grid gap-7 sm:grid-cols-2">
                  <div>
                    <p className="visr-label text-white/35">Included</p>
                    <p className="mt-3 leading-7 text-white/65">1× VISR Carry<br />1× VISR Link<br />1× Strap</p>
                  </div>
                  <div>
                    <p className="visr-label text-white/35">Sold Separately</p>
                    <p className="mt-3 leading-7 text-white/65">Halo Collection<br />Additional VISR Link<br />Diecast car</p>
                    <LinkStockStatus />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="configure" className="border-t border-white/[0.07] py-32 md:py-52">
          <div className="visr-container text-center">
            <p className="visr-label mb-7 text-white/42">The Invitation</p>
            <h2 className="mx-auto max-w-[11ch] text-[clamp(3rem,7vw,8rem)] font-normal leading-[0.94] tracking-[-0.055em]">Your collection deserves its moment.</h2>
            <div className="mx-auto mt-8 max-w-xl text-base leading-7 text-white/48">
              <p>VISR Carry — Batch 2 Preorder.</p>
              <p><span className="text-white/75">{formatRupiah(catalog.carry.price)} preorder</span></p>
              <p>Website exclusive · {catalog.carry.stock} units currently available.</p>
            </div>
            <PreorderCta forceOpen={previewOpen} />
          </div>
        </section>

        <VisrFaq />

        <footer className="border-t border-white/[0.07] bg-[#030303]">
          <div className="visr-container py-16 md:py-24">
            <div className="grid gap-14 border-b border-white/10 pb-14 md:grid-cols-12 md:pb-20">
              <div className="md:col-span-6">
                <p className="visr-label text-white/35">VISR</p>
                <h2 className="mt-6 max-w-[8ch] text-[clamp(3.4rem,7vw,7.5rem)] font-normal leading-[0.88] tracking-[-0.06em]">
                  Carry Your Build.
                </h2>
                <p className="mt-8 max-w-md text-sm leading-7 text-white/42">
                  A handmade magnetic display system for collectors who want the car—not the frame—to remain the hero.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-10 md:col-span-5 md:col-start-8">
                <nav aria-label="Explore VISR" className="flex flex-col gap-4">
                  <p className="visr-label mb-2 text-white/25">Explore</p>
                  <a href="#link-system" className={footerLinkClass}>VISR Link</a>
                  <a href="#carry" className={footerLinkClass}>VISR Carry</a>
                  <a href="#halo" className={footerLinkClass}>Halo Collection</a>
                  <a href="#faq" className={footerLinkClass}>FAQ</a>
                </nav>

                <nav aria-label="VISR support" className="flex flex-col gap-4">
                  <p className="visr-label mb-2 text-white/25">Support</p>
                  <a href="/order" className={footerLinkClass}>Track Your Order</a>
                  <a href="https://wa.me/6281806288892" className={footerLinkClass}>WhatsApp</a>
                  <a href="/privacy" className={footerLinkClass}>Privacy Notice</a>
                  <PrivacyChoicesButton className={`${footerLinkClass} text-left`} />
                </nav>
              </div>
            </div>

            <div className="flex flex-col gap-4 pt-7 text-[10px] uppercase tracking-[0.16em] text-white/25 sm:flex-row sm:items-center sm:justify-between">
              <span>VISR © 2026 · Bandung, Indonesia</span>
              <span>Link / Carry / Halo</span>
            </div>
          </div>
        </footer>
      </main>
    </MobileOnlyPage>
  );
}
