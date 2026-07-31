"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

const halos = [
  { slug: "crimson", name: "Crimson Halo", line: "Bold Presence", description: "A decisive red glow that turns the display into a statement.", rgb: "208 28 48" },
  { slug: "ice", name: "Ice Halo", line: "Pure Focus", description: "A colder atmosphere that removes noise and sharpens the object.", rgb: "126 226 255" },
  { slug: "emerald", name: "Emerald Halo", line: "Quiet Depth", description: "A composed green presence with depth that reveals itself slowly.", rgb: "36 194 132" },
  { slug: "amber", name: "Amber Halo", line: "Warm Precision", description: "A warm architectural light that gives the display a gallery-like calm.", rgb: "235 169 49" },
  { slug: "pink", name: "Pink Halo", line: "Unexpected Elegance", description: "A playful tone held inside a restrained and precise display system.", rgb: "255 78 166" },
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
      const nextProgress = Math.min(1, Math.max(0, -rect.top / scrollable));
      const sequenceProgress = Math.min(0.999, nextProgress / 0.82);

      setProgress(nextProgress);
      setActiveIndex(Math.min(halos.length - 1, Math.floor(sequenceProgress * halos.length)));
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
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
      style={{ "--active-rgb": active.rgb } as CSSProperties}
    >
      <div className="halo-stage" data-ending={endingVisible}>
        <div className="halo-atmospheres" aria-hidden="true">
          {halos.map((halo, index) => (
            <div
              key={halo.slug}
              className="halo-atmosphere"
              data-active={index === activeIndex}
              style={{ "--halo-rgb": halo.rgb } as CSSProperties}
            />
          ))}
          <div className="halo-finale-ambient" />
        </div>

        <div className="halo-vignette" aria-hidden="true" />

        <header className="halo-header visr-container">
          <div>
            <p className="visr-label">Halo Collection</p>
            <p className="halo-note">Five personalities. One display philosophy.</p>
          </div>
          <p className="halo-counter">0{activeIndex + 1} / 05</p>
        </header>

        <div className="halo-object" data-ending={endingVisible}>
          <div className="halo-lighting" aria-hidden="true">
            {halos.map((halo, index) => (
              <div
                key={halo.slug}
                className="halo-light"
                data-active={index === activeIndex}
                style={{ "--halo-rgb": halo.rgb } as CSSProperties}
              >
                <span className="halo-light__backlight" />
                <span className="halo-light__rim" />
                <span className="halo-light__reflection" />
              </div>
            ))}
          </div>
          <img src={`/images/halo/halo-${active.slug}.webp`} alt={`${active.name} VISR Carry display`} />
          <div className="halo-object__wash" aria-hidden="true" />
        </div>

        <div className="halo-copy visr-container" data-ending={endingVisible}>
          {halos.map((halo, index) => (
            <article key={halo.slug} data-active={index === activeIndex}>
              <p>{halo.name}</p>
              <h2 id={index === 0 ? "halo-collection-title" : undefined}>{halo.line}</h2>
              <span>{halo.description}</span>
            </article>
          ))}
        </div>

        <div className="halo-rail" aria-hidden="true">
          {halos.map((halo, index) => (
            <span
              key={halo.slug}
              data-active={index === activeIndex}
              style={{ "--halo-rgb": halo.rgb } as CSSProperties}
            />
          ))}
        </div>

        <div className="halo-finale visr-container" data-visible={endingVisible}>
          <div>
            <p className="visr-label">The complete collection</p>
            <h3>Choose your Halo.</h3>
            <p>Five distinct atmospheres. One display system.</p>
            <a href="/checkout">Reserve your Halo</a>
          </div>
          <div className="halo-lineup" aria-label="Five Halo colour identities">
            {halos.map((halo) => (
              <figure key={halo.slug} style={{ "--halo-rgb": halo.rgb } as CSSProperties}>
                <div>
                  <img src={`/images/halo/halo-${halo.slug}.webp`} alt="" />
                </div>
                <figcaption>{halo.name.replace(" Halo", "")}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>

      <div className="halo-scroll-map" aria-hidden="true">
        {halos.map((halo) => <div key={halo.slug} />)}
        <div />
      </div>

      <style jsx>{`
        .halo-exhibition {
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

        .halo-atmospheres {
          position: absolute;
          z-index: -3;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          contain: strict;
        }

        .halo-atmosphere,
        .halo-finale-ambient {
          position: absolute;
          inset: -18%;
          opacity: 0;
          transform: translate3d(0, 0, 0) scale(1.02);
          will-change: opacity, transform;
          transition: opacity 1200ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .halo-atmosphere::before,
        .halo-atmosphere::after {
          position: absolute;
          content: "";
          pointer-events: none;
        }

        .halo-atmosphere::before {
          inset: 5% 8% 10%;
          background:
            radial-gradient(
              ellipse at 50% 48%,
              rgb(var(--halo-rgb) / 0.22) 0%,
              rgb(var(--halo-rgb) / 0.09) 28%,
              transparent 62%
            ),
            radial-gradient(
              ellipse at 50% 66%,
              rgb(var(--halo-rgb) / 0.09) 0%,
              transparent 58%
            );
          filter: blur(30px);
          animation: halo-ambient-breathe 8s ease-in-out infinite;
        }

        .halo-atmosphere::after {
          inset: 22% 20% 14%;
          background: radial-gradient(
            ellipse at 50% 48%,
            rgb(var(--halo-rgb) / 0.2),
            transparent 64%
          );
          filter: blur(54px);
          animation: halo-ambient-pulse 11s ease-in-out infinite;
        }

        .halo-atmosphere[data-active="true"] {
          opacity: 1;
        }

        .halo-finale-ambient {
          background:
            radial-gradient(
              ellipse at 50% 46%,
              rgb(255 255 255 / 0.075),
              transparent 38%
            ),
            radial-gradient(
              ellipse at 50% 74%,
              rgb(172 180 190 / 0.055),
              transparent 54%
            );
          filter: blur(22px);
          transform: translate3d(0, 0, 0) scale(1);
        }

        .halo-stage[data-ending="true"] .halo-atmosphere {
          opacity: 0;
        }

        .halo-stage[data-ending="true"] .halo-finale-ambient {
          opacity: 1;
        }

        .halo-vignette {
          position: absolute;
          z-index: 5;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(
              180deg,
              rgb(0 0 0 / 0.68),
              transparent 26%,
              transparent 66%,
              rgb(0 0 0 / 0.9)
            ),
            radial-gradient(circle at center, transparent 30%, rgb(0 0 0 / 0.6));
        }

        .halo-header {
          position: absolute;
          z-index: 12;
          top: clamp(5rem, 8svh, 7.5rem);
          right: 0;
          left: 0;
          display: flex;
          justify-content: space-between;
          gap: 2rem;
        }

        .halo-header p {
          margin: 0;
        }

        .halo-header .visr-label {
          color: rgb(247 247 245 / 0.48);
        }

        .halo-note {
          margin-top: 0.8rem !important;
          color: rgb(247 247 245 / 0.3);
          font-size: 0.72rem;
        }

        .halo-counter {
          color: rgb(247 247 245 / 0.62);
          font-size: 0.68rem;
          letter-spacing: 0.18em;
        }

        .halo-object {
          position: absolute;
          z-index: 1;
          top: 50%;
          left: 50%;
          width: min(72vw, 920px);
          height: min(65svh, 720px);
          transform: translate3d(-50%, -48%, 0);
          transition:
            opacity 650ms ease,
            transform 900ms cubic-bezier(0.22, 1, 0.36, 1);
          will-change: opacity, transform;
        }

        .halo-object[data-ending="true"] {
          opacity: 0;
          transform: translate3d(-50%, -48%, 0) scale(0.92);
        }

        .halo-object > img {
          position: absolute;
          z-index: 3;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: contain;
          filter: drop-shadow(0 22px 30px rgb(0 0 0 / 0.38));
        }

        .halo-lighting {
          position: absolute;
          z-index: 1;
          inset: 0;
          pointer-events: none;
          contain: layout paint;
        }

        .halo-light {
          position: absolute;
          inset: 0;
          opacity: 0;
          transform: translate3d(0, 0, 0);
          will-change: opacity;
          transition: opacity 1100ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .halo-light[data-active="true"] {
          opacity: 1;
        }

        .halo-light span {
          position: absolute;
          display: block;
          pointer-events: none;
        }

        .halo-light__backlight {
          inset: 17% 7% 8%;
          border-radius: 50%;
          background:
            radial-gradient(
              ellipse at 50% 48%,
              rgb(var(--halo-rgb) / 0.42) 0%,
              rgb(var(--halo-rgb) / 0.17) 34%,
              transparent 70%
            );
          filter: blur(34px);
          animation: halo-backlight-breathe 6.8s ease-in-out infinite;
        }

        .halo-light__rim {
          inset: 12% 5% 9%;
          border: 1px solid rgb(var(--halo-rgb) / 0.26);
          border-radius: 48%;
          background: radial-gradient(
            ellipse at 50% 50%,
            transparent 56%,
            rgb(var(--halo-rgb) / 0.12) 73%,
            transparent 79%
          );
          filter: blur(7px);
          mask-image: linear-gradient(
            115deg,
            transparent 5%,
            #000 27%,
            #000 66%,
            transparent 94%
          );
          animation: halo-rim-pulse 9s ease-in-out infinite;
        }

        .halo-light__reflection {
          right: 13%;
          bottom: 3%;
          left: 13%;
          height: 17%;
          border-radius: 50%;
          background: radial-gradient(
            ellipse,
            rgb(var(--halo-rgb) / 0.2) 0%,
            rgb(var(--halo-rgb) / 0.07) 38%,
            transparent 72%
          );
          filter: blur(20px);
          transform: scaleY(0.42);
          opacity: 0.72;
          animation: halo-reflection-pulse 8.5s ease-in-out infinite;
        }

        .halo-object__wash {
          position: absolute;
          z-index: 4;
          inset: 5% 4%;
          background: linear-gradient(
            135deg,
            transparent 28%,
            rgb(var(--active-rgb) / 0.13) 55%,
            transparent 78%
          );
          mix-blend-mode: screen;
          mask-image: radial-gradient(ellipse at center, #000 22%, transparent 72%);
          opacity: 0.72;
          transition:
            background-color 900ms ease,
            opacity 900ms ease;
          animation: halo-wash-drift 12s ease-in-out infinite;
        }

        .halo-copy {
          position: absolute;
          z-index: 10;
          right: 0;
          bottom: clamp(4rem, 8svh, 7rem);
          left: 0;
          transition:
            opacity 500ms ease,
            transform 700ms ease;
        }

        .halo-copy[data-ending="true"] {
          opacity: 0;
          transform: translate3d(0, 20px, 0);
        }

        .halo-copy article {
          position: absolute;
          bottom: 0;
          left: 0;
          width: min(35rem, calc(100vw - 3rem));
          opacity: 0;
          transform: translate3d(0, 22px, 0);
          transition:
            opacity 550ms ease,
            transform 800ms cubic-bezier(0.22, 1, 0.36, 1);
          will-change: opacity, transform;
        }

        .halo-copy article[data-active="true"] {
          opacity: 1;
          transform: translate3d(0, 0, 0);
        }

        .halo-copy article p {
          margin: 0 0 0.8rem;
          color: rgb(var(--active-rgb) / 0.92);
          font-size: 0.68rem;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .halo-copy h2 {
          max-width: 8ch;
          margin: 0;
          font-size: clamp(3.2rem, 8vw, 7rem);
          font-weight: 400;
          line-height: 0.9;
          letter-spacing: -0.065em;
        }

        .halo-copy span {
          display: block;
          max-width: 29rem;
          margin-top: 1.25rem;
          color: rgb(247 247 245 / 0.48);
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
          align-items: flex-end;
          gap: 0.4rem;
          transform: translateY(-50%);
        }

        .halo-rail span {
          width: 2px;
          height: 42%;
          background: rgb(247 247 245 / 0.16);
          transition:
            height 550ms ease,
            background 500ms ease;
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
          gap: 3rem;
          opacity: 0;
          transform: translate3d(0, 30px, 0);
          pointer-events: none;
          transition:
            opacity 850ms ease,
            transform 1s cubic-bezier(0.22, 1, 0.36, 1);
          will-change: opacity, transform;
        }

        .halo-finale[data-visible="true"] {
          opacity: 1;
          transform: translate3d(0, 0, 0);
          pointer-events: auto;
        }

        .halo-finale h3 {
          margin: 0;
          font-size: clamp(3.5rem, 9vw, 8rem);
          font-weight: 400;
          line-height: 0.9;
          letter-spacing: -0.07em;
        }

        .halo-finale > div > p:last-of-type {
          color: rgb(247 247 245 / 0.48);
        }

        .halo-finale a {
          display: inline-flex;
          margin-top: 1.4rem;
          border: 1px solid rgb(247 247 245 / 0.2);
          border-radius: 999px;
          padding: 0.9rem 1.25rem;
          color: inherit;
          font-size: 0.78rem;
          text-decoration: none;
        }

        .halo-lineup {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 0.65rem;
          width: 100%;
          min-width: 0;
          overflow: hidden;
        }

        .halo-lineup figure {
          margin: 0;
          min-width: 0;
        }

        .halo-lineup figure div {
          position: relative;
          width: 100%;
          overflow: hidden;
          aspect-ratio: 4 / 5;
          border: 1px solid rgb(var(--halo-rgb) / 0.28);
          background: #050505;
        }

        .halo-lineup img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .halo-lineup figcaption {
          margin-top: 0.55rem;
          overflow: hidden;
          color: rgb(var(--halo-rgb) / 0.9);
          font-size: 0.6rem;
          letter-spacing: 0.12em;
          text-overflow: ellipsis;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .halo-scroll-map {
          position: absolute;
          inset: 0;
          display: grid;
          grid-template-rows: repeat(6, 1fr);
          pointer-events: none;
        }

        @keyframes halo-ambient-breathe {
          0%,
          100% {
            opacity: 0.78;
            transform: scale(0.98);
          }
          50% {
            opacity: 1;
            transform: scale(1.035);
          }
        }

        @keyframes halo-ambient-pulse {
          0%,
          100% {
            opacity: 0.48;
            transform: translate3d(-1%, 0, 0) scale(0.96);
          }
          50% {
            opacity: 0.78;
            transform: translate3d(1%, -1%, 0) scale(1.04);
          }
        }

        @keyframes halo-backlight-breathe {
          0%,
          100% {
            opacity: 0.76;
            transform: scale(0.98);
          }
          50% {
            opacity: 1;
            transform: scale(1.035);
          }
        }

        @keyframes halo-rim-pulse {
          0%,
          100% {
            opacity: 0.38;
            transform: scale(0.99);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.018);
          }
        }

        @keyframes halo-reflection-pulse {
          0%,
          100% {
            opacity: 0.48;
            transform: scaleX(0.96) scaleY(0.4);
          }
          50% {
            opacity: 0.76;
            transform: scaleX(1.04) scaleY(0.46);
          }
        }

        @keyframes halo-wash-drift {
          0%,
          100% {
            opacity: 0.46;
            transform: translate3d(-1%, 0, 0);
          }
          50% {
            opacity: 0.74;
            transform: translate3d(1%, -0.5%, 0);
          }
        }

        @media (max-width: 767px) {
          .halo-stage {
            min-height: 560px;
          }

          .halo-header,
          .halo-finale {
            padding-right: max(1.25rem, env(safe-area-inset-right));
            padding-left: max(1.25rem, env(safe-area-inset-left));
          }

          .halo-header {
            top: clamp(4.5rem, 7svh, 6rem);
          }

          .halo-note {
            max-width: 14rem;
            line-height: 1.45;
          }

          .halo-object {
            left: 50%;
            width: 100vw;
            max-width: none;
            height: 60svh;
            transform: translate3d(-50%, -46%, 0);
          }

          .halo-object[data-ending="true"] {
            transform: translate3d(-50%, -46%, 0) scale(0.94);
          }

          .halo-object > img {
            width: 100vw;
            max-width: none;
          }

          .halo-light__backlight {
            inset: 20% 3% 10%;
            filter: blur(25px);
          }

          .halo-light__rim {
            inset: 15% 2% 11%;
            filter: blur(5px);
          }

          .halo-light__reflection {
            right: 7%;
            left: 7%;
            filter: blur(16px);
          }

          .halo-atmosphere::before {
            inset: 8% 0 12%;
            filter: blur(24px);
          }

          .halo-atmosphere::after {
            inset: 26% 7% 16%;
            filter: blur(38px);
          }

          .halo-copy {
            bottom: clamp(3.25rem, 7svh, 5rem);
          }

          .halo-copy article {
            left: max(1.25rem, env(safe-area-inset-left));
            width: min(
              35rem,
              calc(
                100vw - max(1.25rem, env(safe-area-inset-left)) -
                  max(1.25rem, env(safe-area-inset-right))
              )
            );
          }

          .halo-copy h2 {
            font-size: clamp(3.1rem, 15vw, 5.4rem);
          }

          .halo-copy span {
            max-width: 78vw;
            font-size: 0.8rem;
          }

          .halo-rail {
            display: none;
          }

          .halo-finale {
            align-content: center;
            gap: clamp(1.6rem, 4svh, 2.5rem);
          }

          .halo-finale h3 {
            font-size: clamp(3.15rem, 14.5vw, 5.8rem);
          }

          .halo-lineup {
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: clamp(0.28rem, 1.5vw, 0.5rem);
            overflow: hidden;
            padding: 0;
            overscroll-behavior-x: none;
            touch-action: pan-y;
          }

          .halo-lineup figure div {
            width: 100%;
          }

          .halo-lineup figcaption {
            margin-top: 0.45rem;
            font-size: clamp(0.42rem, 1.7vw, 0.54rem);
            letter-spacing: 0.08em;
          }

          .halo-object__wash {
            animation-duration: 15s;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .halo-atmosphere::before,
          .halo-atmosphere::after,
          .halo-light__backlight,
          .halo-light__rim,
          .halo-light__reflection,
          .halo-object__wash {
            animation: none;
          }

          .halo-atmosphere,
          .halo-finale-ambient,
          .halo-object,
          .halo-light,
          .halo-copy article,
          .halo-finale {
            transition: none;
          }
        }
      `}</style>
    </section>
  );
}
