import { isPreorderPreviewOverride } from "@/lib/commerce/preorder-server";
import { PreorderCta } from "@/components/commerce/preorder-cta";

const assurances = [
  ["Website exclusive", "Batch 2 is reserved only through visr.works."],
  ["Built in one batch", "Production starts after preorder closes and takes up to 14 business days."],
  ["Dispatched after inspection", "Each finished unit ships as soon as it passes final inspection."],
] as const;

export function PreorderSummary() {
  const previewOpen = isPreorderPreviewOverride();

  return (
    <section id="preorder" className="border-y border-white/[0.07] bg-white/[0.018] py-20 md:py-28">
      <div className="visr-container">
        <div className="grid gap-14 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <p className="visr-label text-white/42">VISR Carry Gen 2 · Batch 2</p>
            <h1 className="mt-6 max-w-[12ch] text-[clamp(3.2rem,7vw,7.8rem)] font-normal leading-[0.92] tracking-[-0.055em]">
              Reserve the display. Keep the collection the hero.
            </h1>
          </div>

          <div className="md:col-span-4 md:col-start-9">
            <div className="flex items-end gap-4">
              <p className="text-[clamp(2.5rem,5vw,4.8rem)] leading-none tracking-[-0.05em]">Rp179.000</p>
              <p className="pb-1 text-sm leading-5 text-white/38">preorder<br />Rp199.000 ready stock</p>
            </div>
            <p className="mt-6 max-w-md text-sm leading-6 text-white/52">
              Includes one VISR Carry Gen 2 and two VISR Link. Limited to 100 units for Batch 2.
            </p>
            <div className="text-left [&>a]:mt-8 [&>p]:mx-0 [&>div]:mx-0">
              <PreorderCta forceOpen={previewOpen} />
            </div>
          </div>
        </div>

        <div className="mt-16 grid gap-px overflow-hidden border border-white/[0.08] bg-white/[0.08] md:grid-cols-3">
          {assurances.map(([title, description]) => (
            <div key={title} className="bg-[#030303] p-7 md:p-8">
              <p className="text-sm text-white/78">{title}</p>
              <p className="mt-3 text-sm leading-6 text-white/38">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
