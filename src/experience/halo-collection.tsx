"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const halos = [
  {
    slug: "crimson",
    name: "Crimson",
    statement: "Presence without permission.",
    detail: "A decisive red edge that gives the system weight without competing with the collection.",
    edge: "#9f1d28",
    rgb: "159 29 40",
    soft: "#eda4aa",
  },
  {
    slug: "ice",
    name: "Ice",
    statement: "Clarity, held at its edge.",
    detail: "A cool reflection that sharpens the acrylic and leaves the object visually untouched.",
    edge: "#b8e3f2",
    rgb: "184 227 242",
    soft: "#effbff",
  },
  {
    slug: "emerald",
    name: "Emerald",
    statement: "Made for what is worth keeping.",
    detail: "A controlled green glow that feels archival, assured, and built to remain.",
    edge: "#2a9b72",
    rgb: "42 155 114",
    soft: "#a8e6cf",
  },
  {
    slug: "violet",
    name: "Violet",
    statement: "A different point of view.",
    detail: "A restrained violet refraction for collections that refuse the expected perspective.",
    edge: "#7656c9",
    rgb: "118 86 201",
    soft: "#c9baf6",
  },
  {
    slug: "pink",
    name: "Pink",
    statement: "Confidence can be unexpected.",
    detail: "A precise pink edge with enough softness to surprise and enough structure to hold its ground.",
    edge: "#e889b2",
    rgb: "232 137 178",
    soft: "#ffd1e3",
  },
  {
    slug: "amber",
    name: "Amber",
    statement: "Warmth, engineered.",
    detail: "A warm amber line that brings atmosphere to the system without turning it into decoration.",
    edge: "#d69429",
    rgb: "214 148 41",
    soft: "#f4cd82",
  },
] as const;

const STORAGE_KEY = "visr-halo-selection";
const GUIDE_END = 0.72;

type Halo = (typeof halos)[number];

function clampIndex(index: number) {
  return Math.max(0, Math.min(halos.length - 1, index));
}

function HaloArtifact({ halo, idSuffix, animated = false }: { halo: Halo; idSuffix: string; animated?: boolean }) {
  const bodyGradient = `halo-body-${idSuffix}`;
  const glassGradient = `halo-glass-${idSuffix}`;
  const wheelGradient = `halo-wheel-${idSuffix}`;
  const glowFilter = `halo-glow-${idSuffix}`;
  const shadowFilter = `halo-shadow-${idSuffix}`;

  const variables = {
    "--halo-edge": halo.edge,
    "--halo-rgb": halo.rgb,
    "--halo-soft": halo.soft,
  } as CSSProperties;

  return (
    <div className="halo-artifact-shell" style={variables} data-halo-spill={animated ? "true" : undefined}>
      <svg className="halo-artifact" viewBox="0 0 1200 720" role="img" aria-label={`${halo.name} VISR display system`}>
        <defs>
          <linearGradient id={bodyGradient} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#f7f7f5" stopOpacity="0.8" />
            <stop offset="0.45" stopColor="#8b8b87" stopOpacity="0.23" />
            <stop offset="1" stopColor="#f7f7f5" stopOpacity="0.48" />
          </linearGradient>
          <linearGradient id={glassGradient} x1="0" x2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.01" />
            <stop offset="0.52" stopColor="#ffffff" stopOpacity="0.12" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0.025" />
          </linearGradient>
          <radialGradient id={wheelGradient} cx="50%" cy="42%" r="58%">
            <stop offset="0" stopColor="#d1d1cd" stopOpacity="0.4" />
            <stop offset="0.3" stopColor="#242424" />
            <stop offset="0.74" stopColor="#070707" />
            <stop offset="1" stopColor="#000000" />
          </radialGradient>
          <filter id={glowFilter} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
          <filter id={shadowFilter} x="-30%" y="-80%" width="160%" height="260%">
            <feGaussianBlur stdDeviation="22" />
          </filter>
        </defs>

        <ellipse cx="610" cy="572" rx="360" ry="28" fill="#000" opacity="0.72" filter={`url(#${shadowFilter})`} />
        <ellipse cx="615" cy="560" rx="295" ry="17" fill="var(--halo-edge)" opacity="0.11" filter={`url(#${glowFilter})`} />

        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path
            d="M170 132H1030L1092 196V518L1032 566H170L108 518V196L170 132Z"
            fill={`url(#${glassGradient})`}
            stroke="rgba(255,255,255,.18)"
            strokeWidth="1.5"
          />
          <path
            d="M190 154H1010L1064 208V496L1012 540H190L136 496V208L190 154Z"
            stroke="rgba(255,255,255,.065)"
            strokeWidth="1"
          />
          <path
            data-halo-edge={animated ? "true" : undefined}
            d="M170 132H1030L1092 196"
            stroke="var(--halo-edge)"
            strokeWidth="2.8"
            filter={`url(#${glowFilter})`}
          />
          <path
            data-halo-edge={animated ? "true" : undefined}
            d="M1092 196V518L1032 566"
            stroke="var(--halo-edge)"
            strokeOpacity="0.58"
            strokeWidth="2.2"
          />
          <path
            data-halo-edge={animated ? "true" : undefined}
            d="M108 518L170 566H1032"
            stroke="var(--halo-soft)"
            strokeOpacity="0.46"
            strokeWidth="2"
          />
          <path d="M108 518V196L170 132" stroke="rgba(255,255,255,.14)" strokeWidth="1.6" />
        </g>

        <g>
          <path
            d="M418 372L492 288C511 267 537 256 566 256H716C746 256 772 268 790 290L856 372Z"
            fill={`url(#${glassGradient})`}
            stroke="rgba(255,255,255,.18)"
            strokeWidth="2"
          />
          <path
            d="M266 404C305 385 357 375 426 369L474 312C495 287 526 273 558 273H724C757 273 786 287 808 312L860 368C933 376 982 391 1007 416L1037 456C1048 470 1042 491 1024 496L960 512H304L229 496C210 492 203 469 215 454L246 417C252 411 259 407 266 404Z"
            fill={`url(#${bodyGradient})`}
            stroke="rgba(255,255,255,.26)"
            strokeWidth="2"
          />
          <path d="M302 404C452 389 745 387 958 408" fill="none" stroke="rgba(255,255,255,.42)" strokeWidth="2" strokeLinecap="round" />
          <path d="M405 369H864" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="1.5" />
          <path d="M257 442H343" stroke="rgba(255,255,255,.7)" strokeWidth="4" strokeLinecap="round" />
          <path d="M913 440H1001" stroke="rgba(255,255,255,.42)" strokeWidth="4" strokeLinecap="round" />
          <g>
            <circle cx="408" cy="493" r="67" fill={`url(#${wheelGradient})`} />
            <circle cx="408" cy="493" r="32" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="2" />
            <circle cx="408" cy="493" r="7" fill="rgba(255,255,255,.3)" />
          </g>
          <g>
            <circle cx="851" cy="493" r="67" fill={`url(#${wheelGradient})`} />
            <circle cx="851" cy="493" r="32" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="2" />
            <circle cx="851" cy="493" r="7" fill="rgba(255,255,255,.3)" />
          </g>
        </g>

        <g opacity="0.82">
          <path d="M228 182H612" stroke="var(--halo-edge)" strokeWidth="1.5" strokeLinecap="round" filter={`url(#${glowFilter})`} />
          <path d="M612 182H964" stroke="rgba(255,255,255,.08)" strokeWidth="1" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}

export function HaloCollection() {
  const sectionRef = useRef<HTMLElement>(null);
  const mobileRailRef = useRef<HTMLDivElement>(null);
  const activeIndexRef = useRef(0);
  const freeSelectionRef = useRef(false);
  const mobileScrollFrameRef = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [guidedComplete, setGuidedComplete] = useState(false);

  const persistSelection = useCallback((index: number) => {
    const halo = halos[clampIndex(index)];
    window.localStorage.setItem(STORAGE_KEY, halo.slug);
    window.dispatchEvent(new CustomEvent("visr:halo-selection", { detail: halo }));
  }, []);

  const selectHalo = useCallback(
    (index: number, persist = true) => {
      const safeIndex = clampIndex(index);
      if (activeIndexRef.current !== safeIndex) {
        activeIndexRef.current = safeIndex;
        setActiveIndex(safeIndex);
      }
      if (persist) persistSelection(safeIndex);
    },
    [persistSelection],
  );

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const storedIndex = halos.findIndex((halo) => halo.slug === stored);
    if (storedIndex >= 0) selectHalo(storedIndex, false);
  }, [selectHalo]);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const section = sectionRef.current!;
    if (!section) return;

    const media = gsap.matchMedia();

    media.add("(min-width: 768px)", () => {
      let lastGuidedIndex = -1;
      freeSelectionRef.current = false;
      setGuidedComplete(false);

      const trigger = ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: "bottom bottom",
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          if (self.progress < GUIDE_END) {
            if (freeSelectionRef.current) {
              freeSelectionRef.current = false;
              setGuidedComplete(false);
            }

            const guidedProgress = Math.min(self.progress / GUIDE_END, 0.999999);
            const guidedIndex = clampIndex(Math.floor(guidedProgress * halos.length));
            if (guidedIndex !== lastGuidedIndex) {
              lastGuidedIndex = guidedIndex;
              selectHalo(guidedIndex, false);
            }
            return;
          }

          if (!freeSelectionRef.current) {
            freeSelectionRef.current = true;
            setGuidedComplete(true);
            persistSelection(activeIndexRef.current);
          }
        },
      });

      return () => trigger.kill();
    });

    media.add("(max-width: 767px)", () => {
      freeSelectionRef.current = true;
      setGuidedComplete(true);

      const frame = window.requestAnimationFrame(() => {
        const rail = mobileRailRef.current;
        if (!rail) return;
        rail.scrollTo({ left: rail.clientWidth * activeIndexRef.current, behavior: "auto" });
      });

      return () => window.cancelAnimationFrame(frame);
    });

    return () => media.revert();
  }, [persistSelection, selectHalo]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const context = gsap.context(() => {
      gsap.fromTo(
        "[data-halo-edge]",
        { autoAlpha: 0.25, strokeDasharray: "0 1" },
        { autoAlpha: 1, strokeDasharray: "1 0", duration: 1.15, ease: "power3.out", overwrite: true },
      );
      gsap.fromTo(
        "[data-halo-spill]",
        { autoAlpha: 0.55, scale: 0.965 },
        { autoAlpha: 1, scale: 1, duration: 1.2, ease: "power3.out", overwrite: true },
      );
      gsap.fromTo(
        "[data-halo-copy]",
        { autoAlpha: 0, y: 18 },
        { autoAlpha: 1, y: 0, duration: 0.72, ease: "power3.out", overwrite: true },
      );
    }, section);

    return () => context.revert();
  }, [activeIndex]);

  useEffect(() => {
    return () => {
      if (mobileScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(mobileScrollFrameRef.current);
      }
    };
  }, []);

  const handleMobileScroll = () => {
    if (mobileScrollFrameRef.current !== null) return;

    mobileScrollFrameRef.current = window.requestAnimationFrame(() => {
      mobileScrollFrameRef.current = null;
      const rail = mobileRailRef.current;
      if (!rail || rail.clientWidth === 0) return;
      selectHalo(Math.round(rail.scrollLeft / rail.clientWidth), true);
    });
  };

  const activeHalo = halos[activeIndex];
  const activeVariables = {
    "--halo-edge": activeHalo.edge,
    "--halo-rgb": activeHalo.rgb,
    "--halo-soft": activeHalo.soft,
  } as CSSProperties;

  return (
    <section
      ref={sectionRef}
      id="halo"
      className="halo-experience"
      aria-labelledby="halo-title"
      data-free-selection={guidedComplete}
      data-active-halo={activeHalo.slug}
      style={activeVariables}
    >
      <div className="halo-desktop">
        <div className="halo-stage">
          <div className="halo-stage__atmosphere" aria-hidden="true">
            <span className="halo-stage__spill halo-stage__spill--primary" />
            <span className="halo-stage__spill halo-stage__spill--edge" />
            <span className="halo-stage__floor" />
          </div>

          <header className="halo-stage__header visr-container">
            <p className="visr-label">Halo Collection / Six Expressions</p>
            <div className="halo-stage__status" aria-live="polite">
              <span>{guidedComplete ? "Choose your expression" : "Guided reveal"}</span>
              <strong>{String(activeIndex + 1).padStart(2, "0")} / 06</strong>
            </div>
          </header>

          <div className="halo-stage__artifact">
            <HaloArtifact halo={activeHalo} idSuffix={`desktop-${activeHalo.slug}`} animated />
          </div>

          <div className="halo-stage__copy visr-container" data-halo-copy key={activeHalo.slug}>
            <p className="visr-label">{activeHalo.name}</p>
            <h2 id="halo-title">{activeHalo.statement}</h2>
            <p>{activeHalo.detail}</p>
          </div>

          <nav className="halo-selector" aria-label="Select Halo expression">
            {halos.map((halo, index) => (
              <button
                key={halo.slug}
                type="button"
                className="halo-selector__option"
                data-active={index === activeIndex}
                disabled={!guidedComplete}
                onClick={() => selectHalo(index, true)}
                aria-label={`Select ${halo.name} Halo`}
                aria-pressed={index === activeIndex}
              >
                <span className="halo-selector__swatch" style={{ "--option-edge": halo.edge } as CSSProperties} />
                <span>{halo.name}</span>
              </button>
            ))}
          </nav>

          <div className="halo-stage__bridge visr-container" data-visible={guidedComplete}>
            <span>Your Halo is now part of the system.</span>
            <span>Selection saved</span>
          </div>
        </div>
      </div>

      <div className="halo-mobile">
        <header className="halo-mobile__header visr-container">
          <p className="visr-label">Halo Collection</p>
          <h2>One system.<br />Six expressions.</h2>
          <p>Swipe once to move between each Halo.</p>
        </header>

        <div ref={mobileRailRef} className="halo-mobile__rail" onScroll={handleMobileScroll}>
          {halos.map((halo, index) => (
            <article
              key={halo.slug}
              className="halo-mobile__card"
              data-active={index === activeIndex}
              style={{ "--halo-edge": halo.edge, "--halo-rgb": halo.rgb, "--halo-soft": halo.soft } as CSSProperties}
            >
              <div className="halo-mobile__card-atmosphere" aria-hidden="true" />
              <div className="halo-mobile__artifact">
                <HaloArtifact halo={halo} idSuffix={`mobile-${halo.slug}`} />
              </div>
              <div className="halo-mobile__copy visr-container">
                <p className="visr-label">{String(index + 1).padStart(2, "0")} / 06 — {halo.name}</p>
                <h3>{halo.statement}</h3>
                <p>{halo.detail}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="halo-mobile__pagination visr-container" aria-label={`${activeHalo.name} selected`}>
          <div>
            {halos.map((halo, index) => (
              <button
                key={halo.slug}
                type="button"
                data-active={index === activeIndex}
                onClick={() => {
                  const rail = mobileRailRef.current;
                  if (rail) rail.scrollTo({ left: rail.clientWidth * index, behavior: "smooth" });
                  selectHalo(index, true);
                }}
                aria-label={`Show ${halo.name}`}
              />
            ))}
          </div>
          <span>{activeHalo.name} saved</span>
        </div>
      </div>

      <style jsx>{`
        .halo-experience {
          position: relative;
          height: 680svh;
          border-top: 1px solid rgb(255 255 255 / 0.07);
          background: #020202;
        }

        .halo-desktop {
          height: 100%;
        }

        .halo-stage {
          position: sticky;
          top: 0;
          min-height: 100svh;
          overflow: hidden;
          isolation: isolate;
          background:
            radial-gradient(circle at 50% 34%, rgb(255 255 255 / 0.035), transparent 31rem),
            linear-gradient(180deg, #020202 0%, #030303 72%, #050505 100%);
        }

        .halo-stage__atmosphere {
          position: absolute;
          inset: 0;
          z-index: -2;
          pointer-events: none;
        }

        .halo-stage__spill {
          position: absolute;
          display: block;
          border-radius: 999px;
          background: rgb(var(--halo-rgb) / 0.24);
          filter: blur(64px);
          transition: background-color 600ms ease;
        }

        .halo-stage__spill--primary {
          top: 19%;
          left: 19%;
          width: 62%;
          height: 1px;
          box-shadow: 0 0 100px 34px rgb(var(--halo-rgb) / 0.12);
        }

        .halo-stage__spill--edge {
          top: 20%;
          right: 6%;
          width: 1px;
          height: 54%;
          opacity: 0.42;
          box-shadow: 0 0 72px 22px rgb(var(--halo-rgb) / 0.15);
        }

        .halo-stage__floor {
          position: absolute;
          right: 5%;
          bottom: 4%;
          left: 5%;
          height: 20%;
          background: radial-gradient(ellipse at 52% 0%, rgb(var(--halo-rgb) / 0.08), transparent 58%);
          transform: perspective(800px) rotateX(68deg);
          transform-origin: center top;
        }

        .halo-stage__header {
          position: absolute;
          top: 5.4rem;
          right: 0;
          left: 0;
          z-index: 4;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          color: rgb(247 247 245 / 0.42);
        }

        .halo-stage__status {
          display: flex;
          align-items: center;
          gap: 1.2rem;
          color: rgb(247 247 245 / 0.38);
          font-size: 0.7rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .halo-stage__status strong {
          min-width: 4rem;
          color: rgb(247 247 245 / 0.78);
          font-family: var(--font-mono);
          font-size: 0.72rem;
          font-weight: 400;
          text-align: right;
        }

        .halo-stage__artifact {
          position: absolute;
          top: 51%;
          left: 55%;
          width: min(78rem, 76vw);
          transform: translate(-50%, -50%);
        }

        .halo-artifact-shell {
          width: 100%;
          transform-origin: center;
          will-change: transform, opacity;
        }

        .halo-artifact {
          display: block;
          width: 100%;
          height: auto;
          overflow: visible;
          filter: drop-shadow(0 34px 48px rgb(0 0 0 / 0.72));
        }

        .halo-stage__copy {
          position: absolute;
          right: 0;
          bottom: clamp(5.8rem, 10vh, 8.5rem);
          left: 0;
          z-index: 4;
          pointer-events: none;
        }

        .halo-stage__copy > :global(p:first-child) {
          margin: 0 0 1.15rem;
          color: var(--halo-soft);
          opacity: 0.72;
        }

        .halo-stage__copy h2 {
          max-width: 8.5ch;
          margin: 0;
          font-size: clamp(3.3rem, 6.7vw, 8.4rem);
          font-weight: 400;
          line-height: 0.91;
          letter-spacing: -0.06em;
        }

        .halo-stage__copy > :global(p:last-child) {
          max-width: 31rem;
          margin: 1.5rem 0 0;
          color: rgb(247 247 245 / 0.48);
          font-size: clamp(0.92rem, 1.15vw, 1.06rem);
          line-height: 1.65;
        }

        .halo-selector {
          position: absolute;
          top: 50%;
          right: var(--page-gutter);
          z-index: 7;
          display: grid;
          gap: 0.46rem;
          transform: translateY(-50%);
        }

        .halo-selector__option {
          display: grid;
          grid-template-columns: 1.5rem auto;
          min-height: 2.5rem;
          align-items: center;
          gap: 0.75rem;
          padding: 0 0.4rem;
          border: 0;
          color: rgb(247 247 245 / 0.34);
          background: transparent;
          font: inherit;
          font-size: 0.69rem;
          letter-spacing: 0.08em;
          text-align: left;
          text-transform: uppercase;
          cursor: pointer;
          transition: color 260ms ease, opacity 260ms ease;
        }

        .halo-selector__option:disabled {
          cursor: default;
        }

        .halo-selector__option:not(:disabled):hover,
        .halo-selector__option:not(:disabled):focus-visible,
        .halo-selector__option[data-active="true"] {
          color: rgb(247 247 245 / 0.9);
        }

        .halo-selector__swatch {
          display: block;
          width: 1.5rem;
          height: 1px;
          background: var(--option-edge);
          box-shadow: 0 0 10px color-mix(in srgb, var(--option-edge), transparent 35%);
          transform: scaleX(0.45);
          transform-origin: right center;
          transition: transform 320ms var(--ease-product), opacity 320ms ease;
        }

        .halo-selector__option[data-active="true"] .halo-selector__swatch,
        .halo-selector__option:not(:disabled):hover .halo-selector__swatch {
          transform: scaleX(1);
        }

        .halo-experience[data-free-selection="false"] .halo-selector__option:not([data-active="true"]) {
          opacity: 0.32;
        }

        .halo-stage__bridge {
          position: absolute;
          right: 0;
          bottom: 1.65rem;
          left: 0;
          z-index: 5;
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: rgb(247 247 245 / 0.36);
          font-size: 0.67rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          opacity: 0;
          transform: translateY(8px);
          transition: opacity 600ms var(--ease-product), transform 600ms var(--ease-product);
        }

        .halo-stage__bridge[data-visible="true"] {
          opacity: 1;
          transform: translateY(0);
        }

        .halo-stage__bridge span:last-child {
          color: var(--halo-soft);
        }

        .halo-mobile {
          display: none;
        }

        @media (max-width: 767px) {
          .halo-experience {
            height: auto;
            min-height: 100svh;
          }

          .halo-desktop {
            display: none;
          }

          .halo-mobile {
            display: block;
            overflow: hidden;
            background: #020202;
          }

          .halo-mobile__header {
            padding-top: 7.5rem;
            padding-bottom: 2.8rem;
          }

          .halo-mobile__header > :global(p:first-child) {
            margin: 0 0 1.1rem;
            color: rgb(247 247 245 / 0.42);
          }

          .halo-mobile__header h2 {
            margin: 0;
            font-size: clamp(3.3rem, 15vw, 5rem);
            font-weight: 400;
            line-height: 0.92;
            letter-spacing: -0.06em;
          }

          .halo-mobile__header > :global(p:last-child) {
            margin: 1.3rem 0 0;
            color: rgb(247 247 245 / 0.42);
            font-size: 0.86rem;
          }

          .halo-mobile__rail {
            display: grid;
            grid-auto-columns: 100%;
            grid-auto-flow: column;
            overflow-x: auto;
            overscroll-behavior-x: contain;
            scroll-snap-type: x mandatory;
            scrollbar-width: none;
            touch-action: pan-x pan-y;
          }

          .halo-mobile__rail::-webkit-scrollbar {
            display: none;
          }

          .halo-mobile__card {
            position: relative;
            display: grid;
            min-height: 76svh;
            align-content: center;
            overflow: hidden;
            scroll-snap-align: center;
            scroll-snap-stop: always;
            isolation: isolate;
          }

          .halo-mobile__card-atmosphere {
            position: absolute;
            inset: 12% 4% 24%;
            z-index: -1;
            background:
              radial-gradient(ellipse at 50% 40%, rgb(var(--halo-rgb) / 0.13), transparent 46%),
              radial-gradient(ellipse at 50% 76%, rgb(var(--halo-rgb) / 0.08), transparent 52%);
            filter: blur(10px);
          }

          .halo-mobile__artifact {
            width: 146vw;
            margin-left: -24vw;
          }

          .halo-mobile__copy {
            margin-top: -1.2rem;
            padding-bottom: 3.4rem;
          }

          .halo-mobile__copy > :global(p:first-child) {
            margin: 0 0 1rem;
            color: var(--halo-soft);
            opacity: 0.76;
          }

          .halo-mobile__copy h3 {
            max-width: 9ch;
            margin: 0;
            font-size: clamp(2.75rem, 12vw, 4rem);
            font-weight: 400;
            line-height: 0.94;
            letter-spacing: -0.055em;
          }

          .halo-mobile__copy > :global(p:last-child) {
            max-width: 31rem;
            margin: 1.2rem 0 0;
            color: rgb(247 247 245 / 0.46);
            font-size: 0.91rem;
            line-height: 1.6;
          }

          .halo-mobile__pagination {
            display: flex;
            min-height: 5.2rem;
            align-items: center;
            justify-content: space-between;
            border-top: 1px solid rgb(255 255 255 / 0.07);
          }

          .halo-mobile__pagination > div {
            display: flex;
            gap: 0.55rem;
          }

          .halo-mobile__pagination button {
            width: 1.8rem;
            height: 2rem;
            padding: 0;
            border: 0;
            background: transparent;
            cursor: pointer;
          }

          .halo-mobile__pagination button::after {
            display: block;
            width: 100%;
            height: 1px;
            content: "";
            background: rgb(255 255 255 / 0.18);
            transform: scaleX(0.4);
            transition: background-color 260ms ease, transform 260ms var(--ease-product);
          }

          .halo-mobile__pagination button[data-active="true"]::after {
            background: var(--halo-edge);
            box-shadow: 0 0 9px rgb(var(--halo-rgb) / 0.45);
            transform: scaleX(1);
          }

          .halo-mobile__pagination > span {
            color: rgb(247 247 245 / 0.36);
            font-size: 0.65rem;
            letter-spacing: 0.1em;
            text-transform: uppercase;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .halo-stage__spill,
          .halo-selector__swatch,
          .halo-stage__bridge {
            transition: none;
          }
        }
      `}</style>
    </section>
  );
}
