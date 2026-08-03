import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MobileOnlyPage } from "@/components/layout/mobile-only-page";
import { formatRupiah } from "@/lib/commerce/catalog";
import { getLiveCatalog } from "@/lib/commerce/catalog-server";

export const metadata: Metadata = {
  title: "VISR Link — Ready Stock",
  description: "Explore and purchase VISR Link, the magnetic interface behind the VISR ecosystem.",
};

export default async function VisrLinkPage() {
  const catalog = await getLiveCatalog();
  const product = catalog.additionalLink;

  return (
    <MobileOnlyPage>
      <main className="min-h-screen bg-black text-white">
        <section className="relative min-h-[100svh] overflow-hidden border-b border-white/[0.08]">
          <Image
            src="/media/phase-15/visr-e05.jpg"
            alt="VISR Link magnetic interface displayed alone on a dark surface"
            fill
            priority
            sizes="(max-width: 767px) 100vw, 430px"
            className="object-contain object-center"
          />
          <div
            className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.62)_0%,rgba(0,0,0,0.05)_32%,rgba(0,0,0,0.12)_58%,rgba(0,0,0,0.96)_100%)]"
            aria-hidden="true"
          />

          <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
            <Link href="/" className="text-[10px] uppercase tracking-[0.2em] text-white/55 transition hover:text-white">
              VISR
            </Link>
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/35">Link / E05</span>
          </header>

          <div className="absolute inset-x-0 bottom-0 z-10 px-6 pb-[max(3rem,calc(2rem+env(safe-area-inset-bottom)))]">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">The VISR Ecosystem</p>
            <h1 className="mt-4 max-w-[8ch] text-[clamp(4rem,18vw,7rem)] font-normal leading-[0.86] tracking-[-0.065em]">
              VISR Link
            </h1>
            <p className="mt-6 max-w-[30ch] text-sm leading-6 text-white/58">
              The magnetic connection behind the VISR ecosystem. Designed to align precisely, detach effortlessly, and remain ready for what comes next.
            </p>
            <a
              href="#purchase"
              className="mt-8 inline-flex items-center gap-3 border-b border-white/40 pb-2 text-xs uppercase tracking-[0.14em] text-white/90"
            >
              View availability <span aria-hidden="true">↓</span>
            </a>
          </div>
        </section>

        <section id="purchase" className="px-6 py-24">
          <div className="mx-auto max-w-xl">
            <div className="flex items-center justify-between gap-5 border-b border-white/10 pb-7">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Availability</p>
                <div className="mt-3 flex items-center gap-2.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                  <p className="text-sm text-white/85">Ready Stock</p>
                </div>
              </div>
              <p className="text-2xl tracking-[-0.03em]">{formatRupiah(product.price)}</p>
            </div>

            <div className="grid gap-8 border-b border-white/10 py-10 sm:grid-cols-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Dispatch</p>
                <p className="mt-3 text-sm leading-6 text-white/68">Ships within 1–2 business days after payment confirmation.</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Compatibility</p>
                <p className="mt-3 text-sm leading-6 text-white/68">VISR Carry · future VISR Wall and VISR Desk systems.</p>
              </div>
            </div>

            <div className="py-10">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">Built around one standard</p>
              <h2 className="mt-4 max-w-[11ch] text-4xl leading-[0.96] tracking-[-0.05em]">
                One link. More ways to display.
              </h2>
              <p className="mt-5 max-w-[42ch] text-sm leading-7 text-white/52">
                VISR Link is the reusable magnetic interface that connects the collection to the wider VISR system while keeping the hardware visually discreet.
              </p>
            </div>

            <Link
              href="/checkout"
              className="flex w-full items-center justify-center rounded-full bg-white px-6 py-4 text-sm font-medium text-black transition hover:bg-white/85"
            >
              Buy VISR Link
            </Link>
            <p className="mt-4 text-center text-xs leading-5 text-white/32">
              {product.stock} units currently available · secure checkout
            </p>
          </div>
        </section>

        <footer className="border-t border-white/[0.08] px-6 py-10 text-center">
          <Link href="/" className="text-xs uppercase tracking-[0.16em] text-white/45 transition hover:text-white">
            Return to VISR
          </Link>
        </footer>
      </main>
    </MobileOnlyPage>
  );
}
