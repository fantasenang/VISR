import { isPreorderPreviewOverride } from "@/lib/commerce/preorder-server";
import { PreorderCta } from "@/components/commerce/preorder-cta";

export function PreorderSummary() {
  const previewOpen = isPreorderPreviewOverride();

  return (
    <section id="preorder" className="border-y border-white/[0.07] bg-white/[0.018] py-20 md:py-28">
      <div className="visr-container">
        <div className="grid gap-14 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <p className="visr-label text-white/42">VISR Carry Gen 2 · Batch 2</p>
            <h1 className="mt-6 max-w-[13ch] text-[clamp(2.45rem,6vw,6.4rem)] font-normal leading-[0.94] tracking-[-0.05em]">
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
      </div>
    </section>
  );
}
