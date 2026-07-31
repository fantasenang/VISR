"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

const halos = [
  { slug: "ice", name: "Halo Ice", line: "Pure Focus", rgb: "126 226 255", sku: "VISR-HALO-ICE" },
  { slug: "emerald", name: "Halo Emerald", line: "Quiet Depth", rgb: "36 194 132", sku: "VISR-HALO-EMR" },
  { slug: "violet", name: "Halo Violet", line: "Silent Boldness", rgb: "145 91 255", sku: "VISR-HALO-VLT" },
  { slug: "crimson", name: "Halo Crimson", line: "Bold Presence", rgb: "208 28 48", sku: "VISR-HALO-CRM" },
  { slug: "amber", name: "Halo Amber", line: "Warm Precision", rgb: "235 169 49", sku: "VISR-HALO-AMB" },
  { slug: "pink", name: "Halo Pink", line: "Unexpected Elegance", rgb: "255 78 166", sku: "VISR-HALO-PNK" },
] as const;

type StockItem = { remaining: number; soldOut: boolean };
type StockPayload = { products?: Record<string, StockItem> };

export function HaloCollection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [stock, setStock] = useState<Record<string, StockItem>>({});

  useEffect(() => {
    const loadStock = async () => {
      try {
        const response = await fetch("/api/stock", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as StockPayload;
        setStock(payload.products ?? {});
      } catch {
        // Keep the visual experience available if stock lookup is temporarily unavailable.
      }
    };

    void loadStock();
    const timer = window.setInterval(loadStock, 10_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const panels = Array.from(section.querySelectorAll<HTMLElement>("[data-halo-panel]"));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!visible) return;
        const index = Number((visible.target as HTMLElement).dataset.haloPanel ?? 0);
        setActiveIndex(index);
      },
      { threshold: [0.35, 0.55, 0.75] },
    );

    panels.forEach((panel) => observer.observe(panel));
    return () => observer.disconnect();
  }, []);

  const active = halos[activeIndex];

  return (
    <section
      ref={sectionRef}
      id="halo"
      className="halo-identity"
      aria-labelledby="halo-collection-title"
      style={{ "--active-rgb": active.rgb } as CSSProperties}
    >
      <header className="halo-intro visr-container">
        <p className="visr-label">Halo Collection</p>
        <h2 id="halo-collection-title">One object.<br />Six identities.</h2>
      </header>

      <div className="halo-sequence">
        {halos.map((halo, index) => {
          const itemStock = stock[halo.sku];
          const stockLabel = itemStock
            ? itemStock.soldOut
              ? "Sold Out"
              : `${itemStock.remaining} Remaining`
            : "Limited Release";

          return (
            <article
              key={halo.slug}
              className="halo-panel"
              data-halo-panel={index}
              data-active={index === activeIndex}
              style={{ "--halo-rgb": halo.rgb } as CSSProperties}
            >
              <div className="halo-panel__sticky">
                <div className="halo-panel__light" aria-hidden="true" />
                <div
                  className="halo-panel__image"
                  role="img"
                  aria-label={`${halo.name} display`}
                  style={{ backgroundImage: `url('/images/halo/halo-${halo.slug}.webp')` }}
                />
                <div className="halo-panel__copy visr-container">
                  <p>{halo.name}</p>
                  <h3>{halo.line}</h3>
                  <span className="halo-panel__stock" data-sold-out={itemStock?.soldOut || undefined}>{stockLabel}</span>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <footer className="halo-ending visr-container">
        <p>One collection.</p>
        <p>Six identities.</p>
      </footer>

      <style jsx>{`
        .halo-identity { position: relative; overflow: clip; border-top: 1px solid rgb(255 255 255 / 0.07); background: #020202; transition: background-color 700ms ease; }
        .halo-intro { display: flex; min-height: 78svh; flex-direction: column; justify-content: flex-end; padding-top: 8rem; padding-bottom: 5rem; }
        .halo-intro p { margin-bottom: 1.5rem; color: rgb(247 247 245 / 0.42); }
        .halo-intro h2 { max-width: 8ch; margin: 0; font-size: clamp(3.6rem, 17vw, 6.5rem); font-weight: 400; line-height: 0.91; letter-spacing: -0.065em; }
        .halo-panel { position: relative; height: 145svh; }
        .halo-panel__sticky { position: sticky; top: 0; min-height: 100svh; overflow: hidden; isolation: isolate; background: radial-gradient(circle at 50% 41%, rgb(var(--halo-rgb) / 0.09), transparent 45%), linear-gradient(180deg, #020202 0%, #040404 100%); }
        .halo-panel__light { position: absolute; inset: 15% 8% 20%; z-index: -1; border-radius: 999px; background: radial-gradient(ellipse, rgb(var(--halo-rgb) / 0.26), transparent 66%); filter: blur(42px); opacity: 0; transform: scale(0.82); transition: opacity 900ms ease, transform 1200ms cubic-bezier(0.22, 1, 0.36, 1); }
        .halo-panel__image { position: absolute; inset: 13svh 0 21svh; background-position: center; background-repeat: no-repeat; background-size: contain; opacity: 0; filter: brightness(0.7) saturate(0.78); transform: scale(0.985); transition: opacity 900ms ease, filter 1200ms ease, transform 1400ms cubic-bezier(0.22, 1, 0.36, 1); }
        .halo-panel__copy { position: absolute; right: 0; bottom: 7svh; left: 0; opacity: 0; transform: translateY(16px); transition: opacity 600ms ease 220ms, transform 800ms cubic-bezier(0.22, 1, 0.36, 1) 220ms; }
        .halo-panel__copy p { margin: 0 0 0.8rem; color: rgb(var(--halo-rgb) / 0.82); font-size: 0.68rem; letter-spacing: 0.18em; text-transform: uppercase; }
        .halo-panel__copy h3 { max-width: 8ch; margin: 0; font-size: clamp(3.3rem, 15vw, 5.7rem); font-weight: 400; line-height: 0.9; letter-spacing: -0.065em; }
        .halo-panel__stock { display: inline-flex; margin-top: 1.4rem; border: 1px solid rgb(255 255 255 / 0.13); border-radius: 999px; padding: 0.55rem 0.8rem; color: rgb(255 255 255 / 0.55); font-size: 0.65rem; letter-spacing: 0.14em; text-transform: uppercase; }
        .halo-panel__stock[data-sold-out="true"] { color: rgb(255 255 255 / 0.32); }
        .halo-panel[data-active="true"] .halo-panel__light, .halo-panel[data-active="true"] .halo-panel__image, .halo-panel[data-active="true"] .halo-panel__copy { opacity: 1; }
        .halo-panel[data-active="true"] .halo-panel__light { transform: scale(1); }
        .halo-panel[data-active="true"] .halo-panel__image { filter: brightness(1) saturate(1); transform: scale(1); }
        .halo-panel[data-active="true"] .halo-panel__copy { transform: translateY(0); }
        .halo-ending { display: flex; min-height: 88svh; flex-direction: column; justify-content: center; background: radial-gradient(circle at 50% 50%, rgb(var(--active-rgb) / 0.045), transparent 43%); }
        .halo-ending p { margin: 0; font-size: clamp(3.3rem, 15vw, 6rem); font-weight: 400; line-height: 0.93; letter-spacing: -0.065em; }
        .halo-ending p:last-child { color: rgb(247 247 245 / 0.42); }
        @media (min-width: 768px) { .halo-intro h2, .halo-ending p { font-size: 7rem; } .halo-panel__image { inset: 9svh 8vw 17svh; } .halo-panel__copy h3 { font-size: 6.8rem; } }
        @media (prefers-reduced-motion: reduce) { .halo-panel__light, .halo-panel__image, .halo-panel__copy { transition: none; } }
      `}</style>
    </section>
  );
}
