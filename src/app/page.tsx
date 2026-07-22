import { SiteNavigation } from "@/components/navigation/site-navigation";
import { HaloCollection } from "@/experience/halo-collection";
import { OpeningSequence } from "@/experience/opening/opening-sequence";
import { StoryMap } from "@/experience/story-map/story-map";

export default function HomePage() {
  return (
    <main>
      <SiteNavigation />
      <OpeningSequence />

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

      <StoryMap />
      <HaloCollection />

      <section id="carry" className="border-t border-white/[0.07] py-32 md:py-52">
        <div className="visr-container grid gap-12 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <p className="visr-label mb-6 text-white/42">VISR Carry</p>
            <h2 className="visr-display">Arrive with confidence.</h2>
          </div>
          <div className="md:col-span-4 md:col-start-9">
            <p className="visr-copy">Presentation that moves with you. The full cinematic Carry sequence enters after product assets are approved.</p>
          </div>
        </div>
      </section>

      <section id="exhibition" className="border-t border-white/[0.07] py-32 md:py-52">
        <div className="visr-container grid gap-12 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <p className="visr-label mb-6 text-white/42">The Exhibition</p>
            <h2 className="visr-display">Presented with purpose.</h2>
          </div>
          <div className="md:col-span-4 md:col-start-9">
            <p className="visr-copy">Collector environments will enter as editorial stories—never as a generic product grid.</p>
          </div>
        </div>
      </section>

      <section id="configure" className="border-t border-white/[0.07] py-32 md:py-52">
        <div className="visr-container text-center">
          <p className="visr-label mb-7 text-white/42">The Invitation</p>
          <h2 className="mx-auto max-w-[11ch] text-[clamp(3rem,7vw,8rem)] font-normal leading-[0.94] tracking-[-0.055em]">Your collection deserves its moment.</h2>
          <p className="mx-auto mt-8 max-w-xl text-base leading-7 text-white/48">Your selected Halo is now part of the experience and will follow into the configurator.</p>
        </div>
      </section>

      <footer className="border-t border-white/[0.07] py-8">
        <div className="visr-container flex flex-col gap-4 text-xs text-white/35 md:flex-row md:items-center md:justify-between">
          <span className="tracking-[0.16em]">VISR</span>
          <span>Digital Exhibition / Opening, Engineering & Halo</span>
        </div>
      </footer>
    </main>
  );
}
