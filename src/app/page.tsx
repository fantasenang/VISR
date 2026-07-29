import { SiteNavigation } from "@/components/navigation/site-navigation";
import { CarryPhase16 } from "@/experience/carry-phase-16/carry-phase-16";
import { HaloCollection } from "@/experience/halo-collection-revised";
import { LinkSystem } from "@/experience/link-system/link-system";
import { OpeningSequence } from "@/experience/opening/opening-sequence";

export default function HomePage() {
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

      <section id="configure" className="border-t border-white/[0.07] py-32 md:py-52">
        <div className="visr-container text-center">
          <p className="visr-label mb-7 text-white/42">The Invitation</p>
          <h2 className="mx-auto max-w-[11ch] text-[clamp(3rem,7vw,8rem)] font-normal leading-[0.94] tracking-[-0.055em]">Your collection deserves its moment.</h2>
          <p className="mx-auto mt-8 max-w-xl text-base leading-7 text-white/48">
            <span className="block">VISR Carry Batch 2.</span>
            <span className="block">Pre-order price Rp179.000 — website only.</span>
            <span className="block">Pre-order opens soon</span>
          </p>
        </div>
      </section>

      <footer className="border-t border-white/[0.07] py-8">
        <div className="visr-container flex flex-col gap-4 text-xs text-white/35 md:flex-row md:items-center md:justify-between">
          <span className="tracking-[0.16em]">VISR</span>
          <span>Digital Exhibition / Link, Carry & Halo</span>
        </div>
      </footer>
    </main>
  );
}
