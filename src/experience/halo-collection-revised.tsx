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
  const activeIndexRef = useRef(0);
  const endingVisibleRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [endingVisible, setEndingVisible] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    let frame = 0;

    const update = () => {
      frame = 0;
      const rect = section.getBoundingClientRect();
      const scrollable = Math.max(1, section.offsetHeight - window.innerHeight);
      const progress = Math.min(1, Math.max(0, -rect.top / scrollable));
      const sequenceProgress = Math.min(0.999, progress / 0.82);
      const nextIndex = Math.min(halos.length - 1, Math.floor(sequenceProgress * halos.length));
      const nextEndingVisible = progress >= 0.84;

      if (nextIndex !== activeIndexRef.current) {
        activeIndexRef.current = nextIndex;
        setActiveIndex(nextIndex);
      }

      if (nextEndingVisible !== endingVisibleRef.current) {
        endingVisibleRef.current = nextEndingVisible;
        setEndingVisible(nextEndingVisible);
      }
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
                <span className="halo-light__spotlight" />
                <span className="halo-light__plinth" />
              </div>
            ))}
          </div>

          <img
            className="halo-object__image halo-object__image--glow"
            src={`/images/halo/halo-${active.slug}.webp`}
            alt=""
            aria-hidden="true"
          />
          <img
            className="halo-object__image halo-object__image--main"
            src={`/images/halo/halo-${active.slug}.webp`}
            alt={`${active.name} VISR Carry display`}
          />
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
        </div>
      </div>

      <div className="halo-scroll-map" aria-hidden="true">
        {halos.map((halo) => (
          <div key={halo.slug} />
        ))}
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
          inset: 0;
          opacity: 0;
          transform: translate3d(0, 0, 0);
          transition: opacity 1000ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .halo-atmosphere::before,
        .halo-atmosphere::after {
          position: absolute;
          content: "";
          pointer-events: none;
        }

        .halo-atmosphere::before {
          right: 16%;
          bottom: 10%;
          left: 16%;
          height: 18%;
          border-radius: 50%;
          background: radial-gradient(
            ellipse at 50% 50%,
            rgb(var(--halo-rgb) / 0.09) 0%,
            rgb(var(--halo-rgb) / 0.03) 42%,
            transparent 76%
          );
          filter: blur(14px);
          opacity: 0.72;
          transform: scaleX(0.94);
          animation: halo-room-breathe 10s ease-in-out infinite;
          animation-play-state: paused;
        }

        .halo-atmosphere::after {
          inset: 0;
          background:
            radial-gradient(
              ellipse 42% 62% at 50% 26%,
              rgb(255 255 255 / 0.03),
              transparent 72%
            ),
            linear-gradient(180deg, #020202 0%, #050505 54%, #020202 100%);
        }

        .halo-atmosphere[data-active="true"] {
          opacity: 1;
        }

        .halo-atmosphere[data-active="true"]::before {
          animation-play-state: running;
        }

        .halo-finale-ambient {
          background:
            radial-gradient(
              ellipse 54% 58% at 50% 43%,
              rgb(255 255 255 / 0.038),
              transparent 70%
            ),
            linear-gradient(180deg, #020202 0%, #060606 52%, #020202 100%);
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
              rgb(0 0 0 / 0.74),
              transparent 24%,
              transparent 68%,
              rgb(0 0 0 / 0.94)
            ),
            radial-gradient(ellipse at center, transparent 39%, rgb(0 0 0 / 0.6) 100%);
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
          transition:
            opacity 500ms ease,
            transform 700ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .halo-stage[data-ending="true"] .halo-header {
          opacity: 0;
          transform: translate3d(0, -12px, 0);
          pointer-events: none;
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
          transform: translate3d(-50%, -48%, 0) scale(0.95);
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
          transition: opacity 950ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .halo-light[data-active="true"] {
          opacity: 1;
        }

        .halo-light span {
          position: absolute;
          display: block;
          pointer-events: none;
          animation-play-state: paused;
        }

        .halo-light[data-active="true"] span {
          animation-play-state: running;
        }

        .halo-light__spotlight {
          z-index: 0;
          top: -10%;
          left: 50%;
          width: 54%;
          height: 76%;
          background: linear-gradient(
            180deg,
            rgb(255 255 255 / 0.18) 0%,
            rgb(255 255 255 / 0.1) 18%,
            rgb(255 255 255 / 0.05) 46%,
            transparent 88%
          );
          clip-path: polygon(39% 0, 61% 0, 84% 100%, 16% 100%);
          filter: blur(22px);
          opacity: 0.3;
          transform: translate3d(-50%, 0, 0);
          mix-blend-mode: screen;
          animation: halo-spotlight-breathe 12s ease-in-out infinite;
        }

        .halo-light__plinth {
          z-index: 2;
          right: 30%;
          bottom: 10.2%;
          left: 30%;
          height: 8.5%;
          opacity: 0.92;
          transform: translate3d(0, 0, 0);
          animation: halo-plinth-breathe 9s ease-in-out infinite;
        }

        .halo-light__plinth::before,
        .halo-light__plinth::after {
          position: absolute;
          content: "";
          pointer-events: none;
        }

        .halo-light__plinth::before {
          top: 14%;
          right: 11%;
          left: 11%;
          height: 1.5px;
          background: linear-gradient(
            90deg,
            transparent,
            rgb(var(--halo-rgb) / 0.88) 20%,
            rgb(255 255 255 / 0.74) 50%,
            rgb(var(--halo-rgb) / 0.88) 80%,
            transparent
          );
          box-shadow:
            0 0 6px rgb(var(--halo-rgb) / 0.62),
            0 0 16px rgb(var(--halo-rgb) / 0.22);
        }

        .halo-light__plinth::after {
          right: 0;
          bottom: 0;
          left: 0;
          height: 100%;
          border-radius: 50%;
          background: radial-gradient(
            ellipse at 50% 4%,
            rgb(var(--halo-rgb) / 0.18) 0%,
            rgb(var(--halo-rgb) / 0.07) 34%,
            transparent 72%
          );
          filter: blur(9px);
          transform: scaleY(0.42);
          transform-origin: 50% 0;
          opacity: 0.86;
        }

        .halo-object__image {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .halo-object__image--glow {
          z-index: 2;
          opacity: 0.98;
          filter:
            drop-shadow(0 0 2px rgb(var(--active-rgb) / 0.96))
            drop-shadow(0 0 8px rgb(var(--active-rgb) / 0.58))
            drop-shadow(0 0 18px rgb(var(--active-rgb) / 0.34))
            drop-shadow(0 0 34px rgb(var(--active-rgb) / 0.18))
            drop-shadow(0 0 64px rgb(var(--active-rgb) / 0.08))
            drop-shadow(0 14px 20px rgb(var(--active-rgb) / 0.08));
          animation: halo-contour-breathe 10s ease-in-out infinite;
          will-change: filter, opacity;
        }

        .halo-object__image--main {
          z-index: 3;
          filter: drop-shadow(0 24px 34px rgb(0 0 0 / 0.48));
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
          transition: opacity 500ms ease;
        }

        .halo-stage[data-ending="true"] .halo-rail {
          opacity: 0;
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
          opacity: 0;
          transform: translate3d(0, 26px, 0);
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

        .halo-finale > div {
          max-width: 62rem;
        }

        .halo-finale h3 {
          max-width: 8ch;
          margin: 0;
          font-size: clamp(3.5rem, 9vw, 8rem);
          font-weight: 400;
          line-height: 0.9;
          letter-spacing: -0.07em;
        }

        .halo-finale > div > p:last-of-type {
          margin-top: 1.15rem;
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
          transition:
            border-color 250ms ease,
            background-color 250ms ease;
        }

        .halo-finale a:hover {
          border-color: rgb(247 247 245 / 0.42);
          background: rgb(247 247 245 / 0.04);
        }

        .halo-scroll-map {
          position: absolute;
          inset: 0;
          display: grid;
          grid-template-rows: repeat(6, 1fr);
          pointer-events: none;
        }

        @keyframes halo-room-breathe {
          0%,
          100% {
            opacity: 0.56;
            transform: scaleX(0.93);
          }
          50% {
            opacity: 0.76;
            transform: scaleX(0.98);
          }
        }

        @keyframes halo-spotlight-breathe {
          0%,
          100% {
            opacity: 0.24;
          }
          50% {
            opacity: 0.32;
          }
        }

        @keyframes halo-contour-breathe {
          0%,
          100% {
            opacity: 0.94;
          }
          50% {
            opacity: 1;
          }
        }

        @keyframes halo-plinth-breathe {
          0%,
          100% {
            opacity: 0.78;
            transform: translate3d(0, 0, 0) scaleX(0.985);
          }
          50% {
            opacity: 0.96;
            transform: translate3d(0, 0, 0) scaleX(1.015);
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
            transform: translate3d(-50%, -46%, 0) scale(0.96);
          }

          .halo-atmosphere::before {
            right: 11%;
            bottom: 11%;
            left: 11%;
            height: 16%;
          }

          .halo-light__spotlight {
            top: -4%;
            width: 60%;
            height: 66%;
            filter: blur(16px);
            opacity: 0.26;
          }

          .halo-light__plinth {
            right: 27%;
            bottom: 10.8%;
            left: 27%;
            height: 8.5%;
          }

          .halo-light__plinth::before {
            right: 8%;
            left: 8%;
          }

          .halo-light__plinth::after {
            filter: blur(7px);
          }

          .halo-object__image--glow {
            filter:
              drop-shadow(0 0 2px rgb(var(--active-rgb) / 0.94))
              drop-shadow(0 0 7px rgb(var(--active-rgb) / 0.5))
              drop-shadow(0 0 16px rgb(var(--active-rgb) / 0.28))
              drop-shadow(0 0 28px rgb(var(--active-rgb) / 0.14))
              drop-shadow(0 0 48px rgb(var(--active-rgb) / 0.07));
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

          .halo-finale h3 {
            font-size: clamp(3.15rem, 14.5vw, 5.8rem);
          }

          .halo-finale > div > p:last-of-type {
            max-width: 29rem;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .halo-atmosphere::before,
          .halo-light__spotlight,
          .halo-light__plinth,
          .halo-object__image--glow {
            animation: none;
          }

          .halo-atmosphere,
          .halo-finale-ambient,
          .halo-header,
          .halo-object,
          .halo-light,
          .halo-copy article,
          .halo-rail,
          .halo-finale {
            transition: none;
          }
        }
      `}</style>
    </section>
  );
}
