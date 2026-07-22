"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const STORAGE_KEY = "visr-halo-selection";

const haloThemes = {
  crimson: { slug: "crimson", name: "Crimson", edge: "#c41224", rgb: "196 18 36", soft: "#ff6672" },
  ice: { slug: "ice", name: "Ice", edge: "#62d8ff", rgb: "98 216 255", soft: "#d8f7ff" },
  emerald: { slug: "emerald", name: "Emerald", edge: "#22bd82", rgb: "34 189 130", soft: "#a9f0d3" },
  violet: { slug: "violet", name: "Violet", edge: "#8a55ff", rgb: "138 85 255", soft: "#d8c5ff" },
  pink: { slug: "pink", name: "Pink", edge: "#ff3f9f", rgb: "255 63 159", soft: "#ffc1df" },
  amber: { slug: "amber", name: "Amber", edge: "#e7a52a", rgb: "231 165 42", soft: "#ffd78c" },
} as const;

type HaloTheme = (typeof haloThemes)[keyof typeof haloThemes];

const steps = [
  {
    label: "Display",
    headline: "Display, uninterrupted.",
    detail: "The collection stays protected, composed, and completely visible.",
  },
  {
    label: "Connect",
    headline: "Connected with intent.",
    detail: "Precision attachment points meet the frame without adding visual weight.",
  },
  {
    label: "Balance",
    headline: "Held in balance.",
    detail: "The strap carries the system through two engineered points of support.",
  },
  {
    label: "Departure",
    headline: "Arrive with confidence.",
    detail: "The display does not become luggage. It remains VISR—now in motion.",
  },
] as const;

function isHaloTheme(value: unknown): value is HaloTheme {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<HaloTheme>;
  return typeof candidate.slug === "string" && candidate.slug in haloThemes;
}

function resolveStoredHalo(): HaloTheme {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && stored in haloThemes) return haloThemes[stored as keyof typeof haloThemes];
  return haloThemes.crimson;
}

function CarryArtifact({ halo }: { halo: HaloTheme }) {
  const variables = {
    "--carry-halo-edge": halo.edge,
    "--carry-halo-rgb": halo.rgb,
    "--carry-halo-soft": halo.soft,
  } as CSSProperties;

  return (
    <div className="carry-artifact-shell" style={variables}>
      <svg className="carry-artifact" viewBox="0 0 1200 760" role="img" aria-labelledby="carry-artifact-title carry-artifact-description">
        <title id="carry-artifact-title">VISR Carry transformation</title>
        <desc id="carry-artifact-description">A VISR display system gains precision connectors and a shoulder strap before lifting into motion.</desc>

        <defs>
          <linearGradient id="carry-body" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#f7f7f5" stopOpacity="0.82" />
            <stop offset="0.44" stopColor="#8b8b87" stopOpacity="0.23" />
            <stop offset="1" stopColor="#f7f7f5" stopOpacity="0.48" />
          </linearGradient>
          <linearGradient id="carry-glass" x1="0" x2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.012" />
            <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.12" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0.024" />
          </linearGradient>
          <linearGradient id="carry-metal" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#f4f4ef" stopOpacity="0.85" />
            <stop offset="0.5" stopColor="#4d4d49" stopOpacity="0.72" />
            <stop offset="1" stopColor="#d6d6d0" stopOpacity="0.72" />
          </linearGradient>
          <radialGradient id="carry-wheel" cx="50%" cy="42%" r="58%">
            <stop offset="0" stopColor="#d1d1cd" stopOpacity="0.4" />
            <stop offset="0.3" stopColor="#242424" />
            <stop offset="0.74" stopColor="#070707" />
            <stop offset="1" stopColor="#000000" />
          </radialGradient>
          <filter id="carry-halo-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="16" />
          </filter>
          <filter id="carry-soft-shadow" x="-40%" y="-120%" width="180%" height="340%">
            <feGaussianBlur stdDeviation="24" />
          </filter>
          <filter id="carry-connector-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
        </defs>

        <g data-carry-shadow="true">
          <ellipse cx="600" cy="652" rx="365" ry="28" fill="#000" opacity="0.7" filter="url(#carry-soft-shadow)" />
          <ellipse cx="600" cy="640" rx="280" ry="13" fill="var(--carry-halo-edge)" opacity="0.17" filter="url(#carry-halo-glow)" />
        </g>

        <g data-carry-strap-system="true">
          <path
            data-carry-strap="true"
            pathLength="1"
            d="M166 342C286 117 420 54 600 54C780 54 914 117 1034 342"
            fill="none"
            stroke="rgba(18,18,18,.98)"
            strokeWidth="31"
            strokeLinecap="round"
          />
          <path
            data-carry-strap-highlight="true"
            pathLength="1"
            d="M166 342C286 117 420 54 600 54C780 54 914 117 1034 342"
            fill="none"
            stroke="rgba(255,255,255,.16)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            data-carry-strap-stitch="true"
            pathLength="1"
            d="M174 341C293 129 424 70 600 70C776 70 907 129 1026 341"
            fill="none"
            stroke="rgba(255,255,255,.11)"
            strokeWidth="1.4"
            strokeDasharray="0.012 0.018"
            strokeLinecap="round"
          />
        </g>

        <g data-carry-artifact="true">
          <g data-carry-frame="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path
              d="M170 198H1030L1092 262V584L1032 632H170L108 584V262L170 198Z"
              fill="url(#carry-glass)"
              stroke="rgba(255,255,255,.19)"
              strokeWidth="1.6"
            />
            <path d="M190 220H1010L1064 274V562L1012 606H190L136 562V274L190 220Z" stroke="rgba(255,255,255,.07)" strokeWidth="1" />
            <path
              data-carry-halo-edge="true"
              d="M170 198H1030L1092 262"
              stroke="var(--carry-halo-edge)"
              strokeOpacity="0.54"
              strokeWidth="10"
              filter="url(#carry-halo-glow)"
            />
            <path d="M170 198H1030L1092 262" stroke="var(--carry-halo-edge)" strokeWidth="3" />
            <path d="M108 584L170 632H1032" stroke="var(--carry-halo-soft)" strokeOpacity="0.5" strokeWidth="2.2" />
            <path d="M108 584V262L170 198" stroke="rgba(255,255,255,.14)" strokeWidth="1.6" />
          </g>

          <g data-carry-car="true">
            <path d="M418 438L492 354C511 333 537 322 566 322H716C746 322 772 334 790 356L856 438Z" fill="url(#carry-glass)" stroke="rgba(255,255,255,.18)" strokeWidth="2" />
            <path
              d="M266 470C305 451 357 441 426 435L474 378C495 353 526 339 558 339H724C757 339 786 353 808 378L860 434C933 442 982 457 1007 482L1037 522C1048 536 1042 557 1024 562L960 578H304L229 562C210 558 203 535 215 520L246 483C252 477 259 473 266 470Z"
              fill="url(#carry-body)"
              stroke="rgba(255,255,255,.26)"
              strokeWidth="2"
            />
            <path d="M302 470C452 455 745 453 958 474" fill="none" stroke="rgba(255,255,255,.42)" strokeWidth="2" strokeLinecap="round" />
            <path d="M405 435H864" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="1.5" />
            <path d="M257 508H343" stroke="rgba(255,255,255,.7)" strokeWidth="4" strokeLinecap="round" />
            <path d="M913 506H1001" stroke="rgba(255,255,255,.42)" strokeWidth="4" strokeLinecap="round" />
            <g>
              <circle cx="408" cy="559" r="67" fill="url(#carry-wheel)" />
              <circle cx="408" cy="559" r="32" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="2" />
              <circle cx="408" cy="559" r="7" fill="rgba(255,255,255,.3)" />
            </g>
            <g>
              <circle cx="851" cy="559" r="67" fill="url(#carry-wheel)" />
              <circle cx="851" cy="559" r="32" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="2" />
              <circle cx="851" cy="559" r="7" fill="rgba(255,255,255,.3)" />
            </g>
          </g>

          <g data-carry-connector-left="true">
            <rect x="116" y="310" width="66" height="66" rx="16" fill="rgba(5,5,5,.96)" stroke="rgba(255,255,255,.22)" strokeWidth="1.5" />
            <path d="M141 330H174V356H141C132 356 127 351 127 343C127 335 132 330 141 330Z" fill="url(#carry-metal)" />
            <circle cx="158" cy="343" r="19" fill="none" stroke="var(--carry-halo-edge)" strokeOpacity="0.75" strokeWidth="2" />
          </g>
          <g data-carry-connector-right="true">
            <rect x="1018" y="310" width="66" height="66" rx="16" fill="rgba(5,5,5,.96)" stroke="rgba(255,255,255,.22)" strokeWidth="1.5" />
            <path d="M1026 330H1059C1068 330 1073 335 1073 343C1073 351 1068 356 1059 356H1026Z" fill="url(#carry-metal)" />
            <circle cx="1042" cy="343" r="19" fill="none" stroke="var(--carry-halo-edge)" strokeOpacity="0.75" strokeWidth="2" />
          </g>

          <g data-carry-lock-ring="true" opacity="0">
            <circle cx="158" cy="343" r="31" fill="none" stroke="var(--carry-halo-edge)" strokeWidth="3" filter="url(#carry-connector-glow)" />
          </g>
          <g data-carry-lock-ring="true" opacity="0">
            <circle cx="1042" cy="343" r="31" fill="none" stroke="var(--carry-halo-edge)" strokeWidth="3" filter="url(#carry-connector-glow)" />
          </g>
        </g>

        <g data-carry-motion="true" fill="none" strokeLinecap="round">
          <path d="M88 486H26" stroke="rgba(255,255,255,.22)" strokeWidth="1.5" />
          <path d="M108 520H48" stroke="var(--carry-halo-edge)" strokeOpacity="0.5" strokeWidth="1.5" />
          <path d="M1112 464H1170" stroke="rgba(255,255,255,.16)" strokeWidth="1.5" />
        </g>
      </svg>
    </div>
  );
}

export function CarryExperience() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [halo, setHalo] = useState<HaloTheme>(haloThemes.crimson);

  useEffect(() => {
    setHalo(resolveStoredHalo());

    const handleSelection = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (!isHaloTheme(detail)) return;
      setHalo(haloThemes[detail.slug as keyof typeof haloThemes]);
    };

    window.addEventListener("visr:halo-selection", handleSelection);
    return () => window.removeEventListener("visr:halo-selection", handleSelection);
  }, []);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const section = sectionRef.current;
    if (!section) return;
    const sectionElement = section;

    const artifact = sectionElement.querySelector<SVGGElement>("[data-carry-artifact]");
    const shadow = sectionElement.querySelector<SVGGElement>("[data-carry-shadow]");
    const strap = sectionElement.querySelector<SVGPathElement>("[data-carry-strap]");
    const strapHighlight = sectionElement.querySelector<SVGPathElement>("[data-carry-strap-highlight]");
    const strapStitch = sectionElement.querySelector<SVGPathElement>("[data-carry-strap-stitch]");
    const connectorLeft = sectionElement.querySelector<SVGGElement>("[data-carry-connector-left]");
    const connectorRight = sectionElement.querySelector<SVGGElement>("[data-carry-connector-right]");
    const lockRings = sectionElement.querySelectorAll<SVGGElement>("[data-carry-lock-ring]");
    const motion = sectionElement.querySelector<SVGGElement>("[data-carry-motion]");
    const haloEdge = sectionElement.querySelector<SVGPathElement>("[data-carry-halo-edge]");

    if (!artifact || !shadow || !strap || !strapHighlight || !strapStitch || !connectorLeft || !connectorRight || !motion || !haloEdge) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const context = gsap.context(() => {
      gsap.set([strap, strapHighlight, strapStitch], { strokeDasharray: 1, strokeDashoffset: 1, autoAlpha: 0 });
      gsap.set(connectorLeft, { x: -92, autoAlpha: 0 });
      gsap.set(connectorRight, { x: 92, autoAlpha: 0 });
      gsap.set(lockRings, { scale: 0.45, autoAlpha: 0, transformOrigin: "center center" });
      gsap.set(motion, { autoAlpha: 0, x: -18 });
      gsap.set(artifact, { y: 0, rotation: 0, scale: 1, transformOrigin: "50% 52%" });
      gsap.set(shadow, { scaleX: 1, y: 0, autoAlpha: 1, transformOrigin: "50% 50%" });
      gsap.set(haloEdge, { strokeOpacity: 0.48 });

      const timeline = gsap.timeline({ paused: true, defaults: { ease: "none" } });

      timeline
        .to(haloEdge, { strokeOpacity: 0.78, duration: 0.13 }, 0.03)
        .to(connectorLeft, { x: 0, autoAlpha: 1, duration: 0.18, ease: "power3.out" }, 0.18)
        .to(connectorRight, { x: 0, autoAlpha: 1, duration: 0.18, ease: "power3.out" }, 0.18)
        .to(lockRings, { scale: 1, autoAlpha: 0.9, duration: 0.07, ease: "power2.out" }, 0.34)
        .to(lockRings, { scale: 1.35, autoAlpha: 0, duration: 0.09, ease: "power2.in" }, 0.41)
        .to([strap, strapHighlight, strapStitch], { autoAlpha: 1, duration: 0.03 }, 0.39)
        .to(strap, { strokeDashoffset: 0, duration: 0.24, ease: "power2.inOut" }, 0.39)
        .to(strapHighlight, { strokeDashoffset: 0, duration: 0.24, ease: "power2.inOut" }, 0.41)
        .to(strapStitch, { strokeDashoffset: 0, duration: 0.25, ease: "power2.inOut" }, 0.43)
        .to(artifact, { y: -25, rotation: -0.8, duration: 0.17, ease: "power2.inOut" }, 0.57)
        .to(shadow, { scaleX: 0.82, y: 9, autoAlpha: 0.52, duration: 0.17 }, 0.57)
        .to(artifact, { y: -78, rotation: 0.7, scale: 0.955, duration: 0.2, ease: "power3.inOut" }, 0.76)
        .to(shadow, { scaleX: 0.57, y: 20, autoAlpha: 0.26, duration: 0.2 }, 0.76)
        .to(motion, { autoAlpha: 1, x: 0, duration: 0.14, ease: "power2.out" }, 0.82)
        .to(haloEdge, { strokeOpacity: 1, duration: 0.15 }, 0.82);

      if (reduceMotion) {
        sectionElement.dataset.reducedMotion = "true";
        timeline.progress(1);
        setActiveStep(3);
        return;
      }

      let previousStep = -1;
      const trigger = ScrollTrigger.create({
        trigger: sectionElement,
        start: "top top",
        end: "bottom bottom",
        invalidateOnRefresh: true,
        onUpdate: (self: { progress: number }) => {
          timeline.progress(self.progress);
          const nextStep = Math.min(steps.length - 1, Math.floor(self.progress * steps.length));
          if (nextStep !== previousStep) {
            previousStep = nextStep;
            setActiveStep(nextStep);
          }
        },
      });

      return () => trigger.kill();
    }, sectionElement);

    return () => {
      delete sectionElement.dataset.reducedMotion;
      context.revert();
    };
  }, []);

  const variables = {
    "--carry-halo-edge": halo.edge,
    "--carry-halo-rgb": halo.rgb,
    "--carry-halo-soft": halo.soft,
  } as CSSProperties;

  return (
    <section
      ref={sectionRef}
      id="carry"
      className="carry-experience"
      aria-labelledby="carry-title"
      data-active-carry-step={activeStep}
      style={variables}
    >
      <div className="carry-stage">
        <div className="carry-stage__atmosphere" aria-hidden="true">
          <span className="carry-stage__beam" />
          <span className="carry-stage__halo" />
          <span className="carry-stage__floor" />
        </div>

        <header className="carry-stage__header visr-container">
          <div>
            <p className="visr-label">VISR Carry / Transformation Study</p>
            <h2 id="carry-title">From display to departure.</h2>
          </div>
          <div className="carry-stage__status" aria-live="polite">
            <span>{halo.name} Halo carried forward</span>
            <strong>{String(activeStep + 1).padStart(2, "0")} / 04</strong>
          </div>
        </header>

        <div className="carry-stage__artifact" aria-hidden="true">
          <CarryArtifact halo={halo} />
        </div>

        <div className="carry-stage__copy visr-container" aria-live="polite">
          {steps.map((step, index) => (
            <article key={step.label} className="carry-copy" data-active={index === activeStep} aria-hidden={index !== activeStep}>
              <p className="visr-label">{String(index + 1).padStart(2, "0")} — {step.label}</p>
              <h3>{step.headline}</h3>
              <p>{step.detail}</p>
            </article>
          ))}
        </div>

        <ol className="carry-stage__rail" aria-label="VISR Carry transformation sequence">
          {steps.map((step, index) => (
            <li key={step.label} data-active={index === activeStep}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <span>{step.label}</span>
            </li>
          ))}
        </ol>

        <div className="carry-stage__resolution visr-container" data-active={activeStep === steps.length - 1}>
          <span>Your Halo. Your collection. Ready to move.</span>
          <span>VISR Carry</span>
        </div>
      </div>

      <style jsx global>{`
        .carry-experience {
          position: relative;
          min-height: 480svh;
          border-top: 1px solid rgba(255, 255, 255, 0.07);
          background: #030303;
          color: #f5f5f1;
          isolation: isolate;
        }

        .carry-stage {
          position: sticky;
          top: 0;
          height: 100svh;
          min-height: 640px;
          overflow: hidden;
        }

        .carry-stage__atmosphere,
        .carry-stage__beam,
        .carry-stage__halo,
        .carry-stage__floor {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .carry-stage__atmosphere {
          overflow: hidden;
          background:
            radial-gradient(circle at 50% 43%, rgba(255, 255, 255, 0.045), transparent 28%),
            linear-gradient(180deg, #050505 0%, #020202 70%, #000 100%);
        }

        .carry-stage__beam {
          inset: -20% 8% 26%;
          background: radial-gradient(ellipse at 50% 18%, rgba(255, 255, 255, 0.095), rgba(255, 255, 255, 0.018) 38%, transparent 72%);
          filter: blur(24px);
          opacity: 0.8;
        }

        .carry-stage__halo {
          inset: 20% 10% 2%;
          background: radial-gradient(ellipse at 50% 62%, rgb(var(--carry-halo-rgb) / 0.16), transparent 56%);
          filter: blur(42px);
          transition: background 700ms ease;
        }

        .carry-stage__floor {
          top: auto;
          height: 34%;
          background:
            linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.82)),
            radial-gradient(ellipse at 50% 14%, rgb(var(--carry-halo-rgb) / 0.12), transparent 48%);
          border-top: 1px solid rgba(255, 255, 255, 0.035);
        }

        .carry-stage__header {
          position: absolute;
          z-index: 4;
          top: clamp(5rem, 9vh, 7.5rem);
          left: 50%;
          display: flex;
          width: 100%;
          transform: translateX(-50%);
          align-items: flex-start;
          justify-content: space-between;
          gap: 2rem;
        }

        .carry-stage__header h2 {
          max-width: 10ch;
          margin-top: 0.75rem;
          font-size: clamp(2.35rem, 4.8vw, 5.8rem);
          font-weight: 400;
          line-height: 0.94;
          letter-spacing: -0.055em;
        }

        .carry-stage__status {
          display: grid;
          justify-items: end;
          gap: 0.55rem;
          padding-top: 0.2rem;
          color: rgba(255, 255, 255, 0.42);
          font-size: 0.69rem;
          letter-spacing: 0.13em;
          text-transform: uppercase;
        }

        .carry-stage__status strong {
          color: rgba(255, 255, 255, 0.78);
          font-size: 0.75rem;
          font-weight: 500;
          letter-spacing: 0.16em;
        }

        .carry-stage__artifact {
          position: absolute;
          z-index: 2;
          top: 50%;
          left: 50%;
          width: min(76vw, 1080px);
          transform: translate(-50%, -47%);
        }

        .carry-artifact-shell,
        .carry-artifact {
          display: block;
          width: 100%;
        }

        .carry-artifact-shell {
          filter: drop-shadow(0 32px 70px rgba(0, 0, 0, 0.72));
        }

        .carry-stage__copy {
          position: absolute;
          z-index: 4;
          bottom: clamp(4.8rem, 8vh, 7rem);
          left: 50%;
          width: 100%;
          transform: translateX(-50%);
        }

        .carry-copy {
          position: absolute;
          bottom: 0;
          left: 0;
          max-width: 35rem;
          opacity: 0;
          transform: translateY(18px);
          transition: opacity 420ms ease, transform 620ms cubic-bezier(0.22, 1, 0.36, 1);
          pointer-events: none;
        }

        .carry-copy[data-active="true"] {
          opacity: 1;
          transform: translateY(0);
          pointer-events: auto;
        }

        .carry-copy h3 {
          max-width: 13ch;
          margin-top: 0.85rem;
          font-size: clamp(2rem, 3.3vw, 4.1rem);
          font-weight: 400;
          line-height: 0.96;
          letter-spacing: -0.05em;
        }

        .carry-copy > p:last-child {
          max-width: 31rem;
          margin-top: 1.1rem;
          color: rgba(255, 255, 255, 0.52);
          font-size: clamp(0.9rem, 1.05vw, 1.04rem);
          line-height: 1.65;
        }

        .carry-stage__rail {
          position: absolute;
          z-index: 5;
          right: clamp(1.5rem, 4vw, 4.5rem);
          top: 50%;
          display: grid;
          gap: 1rem;
          margin: 0;
          padding: 0;
          transform: translateY(-12%);
          list-style: none;
        }

        .carry-stage__rail li {
          position: relative;
          display: grid;
          grid-template-columns: 1.6rem auto;
          align-items: center;
          gap: 0.8rem;
          color: rgba(255, 255, 255, 0.25);
          font-size: 0.62rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          transition: color 320ms ease, transform 420ms ease;
        }

        .carry-stage__rail li::before {
          position: absolute;
          left: -1.1rem;
          width: 0.45rem;
          height: 1px;
          background: var(--carry-halo-edge);
          box-shadow: 0 0 10px var(--carry-halo-edge);
          content: "";
          opacity: 0;
          transform: scaleX(0);
          transform-origin: right;
          transition: opacity 320ms ease, transform 420ms ease;
        }

        .carry-stage__rail li[data-active="true"] {
          color: rgba(255, 255, 255, 0.82);
          transform: translateX(-0.35rem);
        }

        .carry-stage__rail li[data-active="true"]::before {
          opacity: 1;
          transform: scaleX(1);
        }

        .carry-stage__resolution {
          position: absolute;
          z-index: 5;
          right: 0;
          bottom: 2rem;
          left: 50%;
          display: flex;
          width: 100%;
          transform: translate(-50%, 14px);
          align-items: center;
          justify-content: space-between;
          color: rgba(255, 255, 255, 0.34);
          font-size: 0.66rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          opacity: 0;
          transition: opacity 600ms ease, transform 700ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .carry-stage__resolution[data-active="true"] {
          opacity: 1;
          transform: translate(-50%, 0);
        }

        .carry-experience[data-reduced-motion="true"] {
          min-height: 100svh;
        }

        @media (max-width: 767px) {
          .carry-experience {
            min-height: 420svh;
          }

          .carry-stage {
            min-height: 560px;
          }

          .carry-stage__header {
            top: max(4.6rem, 8.5svh);
            display: block;
            padding-right: max(1.25rem, env(safe-area-inset-right));
            padding-left: max(1.25rem, env(safe-area-inset-left));
            text-align: center;
          }

          .carry-stage__header h2 {
            max-width: 11ch;
            margin-right: auto;
            margin-left: auto;
            font-size: clamp(2.45rem, 11.5vw, 4.4rem);
          }

          .carry-stage__status {
            position: absolute;
            top: 0.15rem;
            right: max(1.25rem, env(safe-area-inset-right));
            justify-items: end;
          }

          .carry-stage__status span {
            display: none;
          }

          .carry-stage__artifact {
            top: 48%;
            width: min(118vw, 650px);
            transform: translate(-50%, -50%);
          }

          .carry-stage__copy {
            bottom: max(6.7rem, calc(5rem + env(safe-area-inset-bottom)));
            padding-right: max(1.5rem, env(safe-area-inset-right));
            padding-left: max(1.5rem, env(safe-area-inset-left));
            text-align: center;
          }

          .carry-copy {
            right: 0;
            left: 0;
            display: grid;
            justify-items: center;
            max-width: none;
            padding: 0 0.4rem;
          }

          .carry-copy h3 {
            max-width: 12ch;
            font-size: clamp(2.1rem, 9.7vw, 3.7rem);
          }

          .carry-copy > p:last-child {
            max-width: 31ch;
            margin-top: 0.9rem;
            font-size: 0.88rem;
            line-height: 1.55;
          }

          .carry-stage__rail {
            top: auto;
            right: 50%;
            bottom: max(3.25rem, calc(2.1rem + env(safe-area-inset-bottom)));
            display: flex;
            gap: 0.55rem;
            transform: translateX(50%);
          }

          .carry-stage__rail li {
            display: block;
            width: 2rem;
            height: 2px;
            overflow: hidden;
            background: rgba(255, 255, 255, 0.13);
            color: transparent;
            transition: width 420ms ease, background 320ms ease, box-shadow 320ms ease;
          }

          .carry-stage__rail li::before {
            display: none;
          }

          .carry-stage__rail li[data-active="true"] {
            width: 3.2rem;
            background: var(--carry-halo-edge);
            box-shadow: 0 0 14px rgb(var(--carry-halo-rgb) / 0.72);
            transform: none;
          }

          .carry-stage__resolution {
            bottom: max(1.05rem, env(safe-area-inset-bottom));
            justify-content: center;
            padding-right: max(1rem, env(safe-area-inset-right));
            padding-left: max(1rem, env(safe-area-inset-left));
            text-align: center;
          }

          .carry-stage__resolution span:last-child {
            display: none;
          }
        }

        @media (max-width: 420px) and (max-height: 760px) {
          .carry-stage__header {
            top: 4.2rem;
          }

          .carry-stage__header h2 {
            font-size: 2.35rem;
          }

          .carry-stage__artifact {
            top: 47%;
            width: 112vw;
          }

          .carry-stage__copy {
            bottom: 6rem;
          }

          .carry-copy h3 {
            font-size: 2rem;
          }

          .carry-copy > p:last-child {
            font-size: 0.8rem;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .carry-copy,
          .carry-stage__rail li,
          .carry-stage__resolution {
            transition: none !important;
          }
        }
      `}</style>
    </section>
  );
}
