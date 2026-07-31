import { PreorderCta } from "@/components/commerce/preorder-cta";
import { SiteNavigation } from "@/components/navigation/site-navigation";
import { CarryPhase16 } from "@/experience/carry-phase-16/carry-phase-16";
import { HaloCollection } from "@/experience/halo-collection-revised";
import { LinkSystem } from "@/experience/link-system/link-system";
import { OpeningSequence } from "@/experience/opening/opening-sequence";
import { isPreorderPreviewOverride } from "@/lib/commerce/preorder-server";

export default function HomePage() {
  const previewOpen = isPreorderPreviewOverride();

  return (
    <main>
      <SiteNavigation />
      <OpeningSequence />
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
                Built after the preorder closes.
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
                  <p className="visr-label text-white/35">Production</p>
                  <p className="mt-3 text-2xl">Maximum 14 business days</p>
                </div>
              </div>

              <p className="max-w-2xl text-base leading-7 text-white/55">
                Preorder may close earlier when all 100 units are reserved. Production begins after the preorder period closes. Finished units are dispatched immediately after passing final inspection, without waiting for the entire batch to be completed.
              </p>

              <div className="grid gap-7 sm:grid-cols-2">
                <div>
                  <p className="visr-label text-white/35">Included</p>
                  <p className="mt-3 leading-7 text-white/65">1× VISR Carry Gen 2<br />2× VISR Link</p>
                </div>
                <div>
                  <p className="visr-label text-white/35">Sold Separately</p>
                  <p className="mt-3 leading-7 text-white/65">Halo Collection<br />Additional VISR Link<br />Diecast car</p>
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
            <p>VISR Carry Gen 2 — Batch 2 Preorder.</p>
            <p><span className="text-white/75">Rp179.000 preorder</span> · Rp199.000 ready stock.</p>
            <p>Website exclusive · 100 units available.</p>
          </div>
          <PreorderCta forceOpen={previewOpen} />
        </div>
      </section>

      <footer className="border-t border-white/[0.07] py-8">
        <div className="visr-container flex flex-col gap-5 text-xs text-white/35 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-6">
            <span className="tracking-[0.16em]">VISR</span>
            <span>Digital Exhibition / Link, Carry & Halo</span>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            <a href="https://wa.me/6281806288892" className="w-fit text-white/55 transition hover:text-white">
              WhatsApp Support
            </a>
            <a href="/order" className="w-fit text-white/55 transition hover:text-white">
              View Order →
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
