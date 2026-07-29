"use client";

import { useMemo, useState } from "react";
import { calculateStackedPackage, formatRupiah, haloVariants, products } from "@/lib/commerce/catalog";

type HaloSelection = Record<string, boolean>;

function QuantityControl({ value, min = 0, max, onChange }: { value: number; min?: number; max: number; onChange: (value: number) => void }) {
  return (
    <div className="flex items-center rounded-full border border-white/15">
      <button type="button" aria-label="Decrease quantity" onClick={() => onChange(Math.max(min, value - 1))} className="h-10 w-10 text-lg text-white/65 transition hover:text-white">−</button>
      <input aria-label="Quantity" inputMode="numeric" value={value} onChange={(event) => onChange(Math.min(max, Math.max(min, Number(event.target.value) || 0)))} className="w-10 bg-transparent text-center text-sm outline-none" />
      <button type="button" aria-label="Increase quantity" onClick={() => onChange(Math.min(max, value + 1))} className="h-10 w-10 text-lg text-white/65 transition hover:text-white">+</button>
    </div>
  );
}

export function CheckoutClient() {
  const [carryQty, setCarryQty] = useState(1);
  const [linkQty, setLinkQty] = useState(0);
  const [halo, setHalo] = useState<HaloSelection>({});

  const selectedHalo = haloVariants.filter((variant) => halo[variant.id]);
  const subtotal = carryQty * products.carry.price + selectedHalo.length * products.halo.price + linkQty * products.additionalLink.price;
  const totalWeight = carryQty * products.carry.weightGrams + selectedHalo.length * products.halo.weightGrams + linkQty * products.additionalLink.weightGrams;
  const totalBoxes = carryQty + selectedHalo.length + linkQty;
  const packageSize = useMemo(() => calculateStackedPackage(totalBoxes), [totalBoxes]);

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="visr-container py-12 md:py-20">
        <a href="/" className="visr-label text-white/45">← Back to exhibition</a>
        <div className="mt-12 grid gap-14 lg:grid-cols-[1.15fr_0.85fr]">
          <section>
            <p className="visr-label text-white/42">Reserve Your VISR</p>
            <h1 className="mt-5 max-w-[10ch] text-[clamp(3.5rem,8vw,7.5rem)] font-normal leading-[0.9] tracking-[-0.06em]">Build your Batch 2 reservation.</h1>

            <div className="mt-16 border-t border-white/10">
              <article className="grid gap-7 border-b border-white/10 py-9 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <p className="text-2xl">VISR Carry Gen 2</p>
                  <p className="mt-2 text-sm text-white/45">Includes one VISR Link, new strap and premium packaging.</p>
                  <p className="mt-4">{formatRupiah(products.carry.price)}</p>
                </div>
                <QuantityControl value={carryQty} min={0} max={products.carry.maxPerOrder} onChange={setCarryQty} />
              </article>

              <article className="border-b border-white/10 py-9">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-2xl">Halo Collection</p>
                    <p className="mt-2 text-sm text-white/45">Choose up to six colors. One unit per color.</p>
                  </div>
                  <p>{formatRupiah(products.halo.price)}</p>
                </div>
                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  {haloVariants.map((variant) => {
                    const selected = Boolean(halo[variant.id]);
                    return (
                      <button key={variant.id} type="button" onClick={() => setHalo((current) => ({ ...current, [variant.id]: !current[variant.id] }))} className={`flex items-center justify-between rounded-2xl border px-5 py-4 text-left transition ${selected ? "border-white bg-white text-black" : "border-white/12 text-white/70 hover:border-white/30"}`}>
                        <span>{variant.name}</span><span className="text-xs">{selected ? "Added ✓" : "Add"}</span>
                      </button>
                    );
                  })}
                </div>
              </article>

              <article className="grid gap-7 border-b border-white/10 py-9 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <p className="text-2xl">Additional VISR Link</p>
                  <p className="mt-2 text-sm text-white/45">Every Carry already includes one. Add extras only when needed.</p>
                  <p className="mt-4">{formatRupiah(products.additionalLink.price)}</p>
                </div>
                <QuantityControl value={linkQty} max={products.additionalLink.maxPerOrder} onChange={setLinkQty} />
              </article>
            </div>
          </section>

          <aside className="lg:sticky lg:top-8 lg:self-start">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-7 md:p-9">
              <p className="visr-label text-white/42">Reservation Summary</p>
              <div className="mt-8 space-y-5 text-sm">
                {carryQty > 0 && <div className="flex justify-between gap-4"><span>VISR Carry Gen 2 × {carryQty}</span><span>{formatRupiah(carryQty * products.carry.price)}</span></div>}
                {selectedHalo.map((variant) => <div key={variant.id} className="flex justify-between gap-4"><span>{variant.name}</span><span>{formatRupiah(products.halo.price)}</span></div>)}
                {linkQty > 0 && <div className="flex justify-between gap-4"><span>Additional VISR Link × {linkQty}</span><span>{formatRupiah(linkQty * products.additionalLink.price)}</span></div>}
              </div>
              <div className="mt-8 border-t border-white/10 pt-6">
                <div className="flex justify-between text-lg"><span>Subtotal</span><span>{formatRupiah(subtotal)}</span></div>
                <p className="mt-3 text-xs leading-5 text-white/40">Shipping is calculated from the destination and paid by the customer.</p>
              </div>
              <div className="mt-8 rounded-2xl bg-white/[0.05] p-5 text-xs leading-5 text-white/50">
                <p>{totalWeight.toLocaleString("id-ID")} g estimated product weight</p>
                <p>{packageSize.lengthCm} × {packageSize.widthCm} × {packageSize.heightCm} cm stacked package</p>
                <p>{totalBoxes} box{totalBoxes === 1 ? "" : "es"}</p>
              </div>
              <button disabled={subtotal === 0} className="mt-7 w-full rounded-full bg-white px-6 py-4 text-sm font-medium text-black transition hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-30">Continue to Information</button>
              <p className="mt-5 text-center text-xs text-white/32">Midtrans payment will be connected after merchant verification.</p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
