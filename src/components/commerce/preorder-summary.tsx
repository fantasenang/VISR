import { isPreorderPreviewOverride } from "@/lib/commerce/preorder-server";
import { PreorderCta } from "@/components/commerce/preorder-cta";
import { formatRupiah } from "@/lib/commerce/catalog";

type PreorderSummaryProps = {
  price: number;
  readyPrice: number;
  stock: number;
};

export function PreorderSummary({ price, readyPrice, stock }: PreorderSummaryProps) {
  const previewOpen = isPreorderPreviewOverride();

  return (
    <section id="preorder" className="border-y border-white/[0.07] bg-white/[0.018] py-16 md:py-24">
      <div className="visr-container">
        <div className="grid gap-10 md:grid-cols-12 md:items-start">
          <div className="md:col-span-4">
            <p className="visr-label text-white/42">VISR Carry Gen 2 · Batch 2</p>
          </div>

          <div className="md:col-span-7 md:col-start-6">
            <div className="flex items-end gap-4">
              <p className="text-[clamp(2.5rem,5vw,4.8rem)] leading-none tracking-[-0.05em]">{formatRupiah(price)}</p>
              <p className="pb-1 text-sm leading-5 text-white/38">preorder<br />{formatRupiah(readyPrice)} ready stock</p>
            </div>
            <p className="mt-6 max-w-md text-sm leading-6 text-white/52">
              Includes one VISR Carry Gen 2 and two VISR Link. {stock} units currently available for Batch 2.
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
