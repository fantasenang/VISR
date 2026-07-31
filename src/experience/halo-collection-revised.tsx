"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

const halos = [
  {
    slug: "crimson",
    name: "Crimson Halo",
    line: "Bold Presence",
    description: "A decisive red glow that turns the display into a statement.",
    rgb: "208 28 48",
  },
  {
    slug: "ice",
    name: "Ice Halo",
    line: "Pure Focus",
    description: "A colder atmosphere that removes noise and sharpens the object.",
    rgb: "126 226 255",
  },
  {
    slug: "emerald",
    name: "Emerald Halo",
    line: "Quiet Depth",
    description: "A composed green presence with depth that reveals itself slowly.",
    rgb: "36 194 132",
  },
  {
    slug: "amber",
    name: "Amber Halo",
    line: "Warm Precision",
    description: "A warm architectural light that gives the display a gallery-like calm.",
    rgb: "235 169 49",
  },
  {
    slug: "pink",
    name: "Pink Halo",
    line: "Unexpected Elegance",
    description: "A playful tone held inside a restrained and precise display system.",
    rgb: "255 78 166",
  },
] as const;

export function HaloCollection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    let frame = 0;

    const update = () => {
      frame = 0;
      const rect = section.getBoundingClientRect();
      const scrollable = Math.max(1, section.offsetHeight - window.innerHeight);
      const travelled = Math.min(scrollable, Math.max(0, -rect.top));
      const nextProgress = travelled / scrollable;
      const sequenceProgress = Math.min(0.999, nextProgress / 0.82);
      const nextIndex = Math.min(halos.length - 1, Math.floor(sequenceProgress * halos.length));

      setProgress(nextProgress);
      setActiveIndex(nextIndex);
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const active = halos[activeIndex];
  const endingVisible = progress >= 0.84;

  return (
    <section
      ref={sectionRef}
      id="halo"
      className="halo-exhibition"
      aria-labelledby="halo-collection-title"
      style={{
        "--active-rgb": active.rgb,
        "--halo-progress": progress,
      } as CSSProperties}
    >
      <div className="halo-stage">
        <div className="halo-ambient" aria-hidden="true" />
        <div className="halo-vignette" aria-hidden="true" />

        <header className="halo-header visr-container">
          <div>
            <p className="visr-label">Halo Collection</p>
            <p className="halo-header__note">Five identities. One display philosophy.</p>
          </div>
          <p className="halo-counter">0{activeIndex + 1} / 05</p>
        </header>

        <div className="halo-object" data-ending={endingVisible}>
          {halos.map((halo, index) => (
            <div
              key={halo.slug}
              className="halo-object__image"
              data-active={index === activeIndex}
              role={index === activeIndex ? "img" : undefined}
              aria-label={index === activeIndex ? `${halo.name} display` : undefined}
              aria-hidden={index === activeIndex ? undefined : true}
              style={{
                backgroundImage: `url('/images/halo/halo-${halo.slug}.webp')`,
                "--halo-rgb": halo.rgb,
              } as CSSProperties}
            />
          ))}
        </div>

        <div className="halo-copy visr-container" data-ending={endingVisible}>
          {halos.map((halo, index) => (
            <article key={halo.slug} className="halo-copy__item" data-active={index === activeIndex}>
              <p>{halo.name}</p>
              <h2 id={index === 0 ? "halo-collection-title" : undefined}>{halo.line}</h2>
              <span>{halo.description}</span>
            </article>
          ))}
        </div>

        <div className="halo-rail" aria-hidden="true">
          {halos.map((halo, index) => (
            <span key={halo.slug} data-active={index === activeIndex} style={{ "--halo-rgb": halo.rgb } as CSSProperties} />
          ))}
        </div>

        <div className="halo-finale visr-container" data-visible={endingVisible}>
          <div className="halo-finale__copy">
            <p className="visr-label">The complete collection</p>
            <h3>Choose your Halo.</h3>
            <p>Five distinct atmospheres. Each made to transform the same object without changing its identity.</p>
            <a href="/checkout">Reserve your Halo</a>
          </div>

          <div className="halo-lineup">
            {halos.map((halo) => (
              <figure key={halo.slug} style={{ "--halo-rgb": halo.rgb } as CSSProperties}>
                <div style={{ backgroundImage: `url('/images/halo/halo-${halo.slug}.webp')` }} />
                <figcaption>{halo.name.replace(" Halo", "")}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>

      <div className="halo-scroll-map" aria-hidden="true">
        {halos.map((halo) => <div key={halo.slug} />)}
        <div className="halo-scroll-map__finale" />
      </div>

      <style jsx>{`
        .halo-exhibition {
          --active-rgb: 208 28 48;
          position: relative;
          height: 720svh;
          border-top: 1px solid rgb(255 255 255 / 0.07);
          background: #020202;
          color: #f7f7f5;
        }

        .halo-stage {
          position: sticky;
          top: 0;
          height: 100svh;
          min-height: 640px;
          overflow: hidden;
          isolation: isolate;
          background: #020202;
        }

        .halo-ambient {
          position: absolute;
          z-index: -3;
          inset: -20%;
          background:
            radial-gradient(circle at 50% 45%, rgb(var(--active-rgb) / 0.2), transparent 25%),
            radial-gradient(ellipse at 50% 55%, rgb(var(--active-rgb) / 0.08), transparent 48%);
          filter: blur(32px);
          transition: background 900ms ease;
        }

        .halo-vignette {
          position: absolute;
          z-index: 5;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(180deg, rgb(0 0 0 / 0.55), transparent 22%, transparent 72%, rgb(0 0 0 / 0.82)),
            radial-gradient(circle at center, transparent 34%, rgb(0 0 0 / 0.56) 100%);
        }

        .halo-header {
          position: absolute;
          z-index: 12;
          top: clamp(5.2rem, 8svh, 7.5rem);
          right: 0;
          left: 0;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 2rem;
        }

        .halo-header .visr-label,
        .halo-counter,
        .halo-header__note {
          margin: 0;
        }

        .halo-header .visr-label {
          color: rgb(247 247 245 / 0.48);
        }

        .halo-header__note {
          margin-top: 0.8rem;
          color: rgb(247 247 245 / 0.28);
          font-size: 0.72rem;
          line-height: 1.5;
        }

        .halo-counter {
          color: rgb(247 247 245 / 0.62);
          font-size: 0.68rem;
          letter-spacing: 0.18em;
          font-variant-numeric: tabular-nums;
        }

        .halo-object {
          position: absolute;
          z-index: 1;
          top: 50%;
          left: 50%;
          width: min(58vw, 850px);
          aspect-ratio: 4 / 5;
          transform: translate(-50%, -47%);
          transition: opacity 700ms ease, transform 1000ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .halo-object[data-ending="true"] {
          opacity: 0;
          transform: translate(-50%, -47%) scale(0.92);
          pointer-events: none;
        }

        .halo-object__image {
          position: absolute;
          inset: 0;
          background-position: center;
          background-repeat: no-repeat;
          background-size: contain;
          opacity: 0;
          filter: brightness(0.68) saturate(0.72) blur(5px);
          transform: scale(1.035);
          transition:
            opacity 750ms ease,
            filter 1000ms ease,
            transform 1300ms cubic-bezier(0.22, 1, 0.36, 1);
          will-change: opacity, transform, filter;
        }

        .halo-object__image::after {
          position: absolute;
          inset: 12% 14% 5%;
          border-radius: 50%;
          background: radial-gradient(ellipse, rgb(var(--halo-rgb) / 0.26), transparent 66%);
          content: "";
          filter: blur(30px);
          opacity: 0;
          transition: opacity 900ms ease;
        }

        .halo-object__image[data-active="true"] {
          opacity: 1;
          filter: brightness(1) saturate(1) blur(0);
          transform: scale(1);
        }

        .halo-object__image[data-active="true"]::after {
          opacity: 1;
        }

        .halo-copy {
          position: absolute;
          z-index: 10;
          right: 0;
          bottom: clamp(4.2rem, 8svh, 7.5rem);
          left: 0;
          pointer-events: none;
          transition: opacity 500ms ease, transform 700ms ease;
        }

        .halo-copy[data-ending="true"] {
          opacity: 0;
          transform: translateY(20px);
        }

        .halo-copy__item {
          position: absolute;
          bottom: 0;
          left: 0;
          width: min(35rem, calc(100vw - 3rem));
          opacity: 0;
          transform: translateY(22px);
          transition: opacity 550ms ease, transform 800ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .halo-copy__item[data-active="true"] {
          opacity: 1;
          transform: translateY(0);
        }

        .halo-copy__item p {
          margin: 0 0 0.8rem;
          color: rgb(var(--active-rgb) / 0.88);
          font-size: 0.68rem;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .halo-copy__item h2 {
          max-width: 8ch;
          margin: 0;
          font-size: clamp(3.2rem, 8vw, 7rem);
          font-weight: 400;
          line-height: 0.9;
          letter-spacing: -0.065em;
        }

        .halo-copy__item span {
          display: block;
          max-width: 29rem;
          margin-top: 1.25rem;
          color: rgb(247 247 245 / 0.46);
          font-size: 0.92rem;
          line-height: 1.7;
        }

        .halo-rail {
          position: absolute;
          z-index: 12;
          top: 50%;
          right: max(1.5rem, calc((100vw - 1480px) / 2));
          display: flex;
          height: 7rem;
          transform: translateY(-50%);
          align-items: flex-end;
          gap: 0.4rem;
        }

        .halo-rail span {
          width: 2px;
          height: 42%;
          background: rgb(247 247 245 / 0.16);
          transform-origin: 50% 100%;
          transition: height 550ms cubic-bezier(0.22, 1, 0.36, 1), background 500ms ease;
        }

        .halo-rail span[data-active="true"] {
          height: 100%;
          background: rgb(var(--halo-rgb) / 0.95);
        }

        .halo-finale {
          position: absolute;
          z-index: 15;
          inset: 0;
          display: grid;
          align-content: center;
          gap: clamp(2rem, 5vw, 5rem);
          opacity: 0;
          transform: translateY(30px);
          pointer-events: none;
          transition: opacity 850ms ease, transform 1100ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .halo-finale[data-visible="true"] {
          opacity: 1;
          transform: translateY(0);
          pointer-events: auto;
        }

        .halo-finale__copy {
          max-width: 42rem;
        }

        .halo-finale__copy .visr-label {
          margin: 0 0 1.4rem;
          color: rgb(247 247 245 / 0.42);
        }

        .halo-finale__copy h3 {
          margin: 0;
          font-size: clamp(3.5rem, 9vw, 8rem);
          font-weight: 400;
          line-height: 0.9;
          letter-spacing: -0.07em;
        }

        .halo-finale__copy > p:last-of-type {
          max-width: 32rem;
          margin: 1.5rem 0 0;
          color: rgb(247 247 245 / 0.46);
          font-size: 0.95rem;
          line-height: 1.7;
        }

        .halo-finale__copy a {
          display: inline-flex;
          margin-top: 1.8rem;
          border: 1px solid rgb(247 247 245 / 0.2);
          border-radius: 999px;
          padding: 0.9rem 1.25rem;
          color: #f7f7f5;
          font-size: 0.78rem;
          text-decoration: none;
          transition: background 250ms ease, color 250ms ease;
        }

        .halo-finale__copy a:hover {
          background: #f7f7f5;
          color: #050505;
        }

        .halo-lineup {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 0.8rem;
        }

        .halo-lineup figure {
          margin: 0;
        }

        .halo-lineup figure > div {
          aspect-ratio: 4 / 5;
          border: 1px solid rgb(var(--halo-rgb) / 0.22);
          background-color: rgb(var(--halo-rgb) / 0.035);
          background-position: center;
          background-repeat: no-repeat;
          background-size: contain;
        }

        .halo-lineup figcaption {
          margin-top: 0.65rem;
          color: rgb(var(--halo-rgb) / 0.75);
          font-size: 0.58rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .halo-scroll-map {
          position: absolute;
          inset: 0;
          display: grid;
          grid-template-rows: repeat(5, 1fr) 1.1fr;
          pointer-events: none;
        }

        @media (max-width: 960px) {
          .halo-object {
            top: 45%;
            width: min(78vw, 680px);
          }

          .halo-copy__item h2 {
            font-size: clamp(3.3rem, 12vw, 6rem);
          }

          .halo-finale {
            align-content: start;
            padding-top: 16svh;
          }
        }

        @media (max-width: 640px) {
          .halo-exhibition {
            height: 660svh;
          }

          .halo-stage {
            min-height: 620px;
          }

          .halo-header {
            top: 4.8rem;
          }

          .halo-header__note {
            display: none;
          }

          .halo-object {
            top: 43%;
            width: calc(100vw - 1.5rem);
          }

          .halo-copy {
            bottom: 2.8rem;
          }

          .halo-copy__item {
            width: calc(100vw - 3.5rem);
          }

          .halo-copy__item h2 {
            font-size: clamp(2.8rem, 13vw, 4.4rem);
          }

          .halo-copy__item span {
            max-width: 23rem;
            margin-top: 0.85rem;
            font-size: 0.78rem;
            line-height: 1.55;
          }

          .halo-rail {
            right: 1rem;
            bottom: 2.8rem;
            top: auto;
            height: 3.5rem;
            transform: none;
          }

          .halo-finale {
            display: flex;
            flex-direction: column;
            justify-content: center;
            padding-top: 6rem;
            padding-bottom: 2rem;
          }

          .halo-finale__copy h3 {
            font-size: clamp(3.2rem, 16vw, 5rem);
          }

          .halo-finale__copy > p:last-of-type {
            max-width: 26rem;
            margin-top: 1rem;
            font-size: 0.8rem;
            line-height: 1.55;
          }

          .halo-finale__copy a {
            margin-top: 1.2rem;
          }

          .halo-lineup {
            grid-template-columns: repeat(5, minmax(78px, 1fr));
            width: max-content;
            max-width: none;
            gap: 0.5rem;
            transform: translateX(calc((100vw - 5 * 78px - 4 * 0.5rem) / 2 - 1.5rem));
          }

          .halo-lineup figure {
            width: 78px;
          }

          .halo-lineup figcaption {
            font-size: 0.48rem;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .halo-object__image,
          .halo-object,
          .halo-copy,
          .halo-copy__item,
          .halo-rail span,
          .halo-finale {
            transition: none;
          }
        }
      `}</style>
    </section>
  );
}
