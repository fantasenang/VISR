"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const engineeringSteps = [
  {
    number: "01",
    title: "Structure",
    statement: "Strength where it matters.",
    detail: "The outer geometry carries the system while the collection remains visually untouched.",
  },
  {
    number: "02",
    title: "Clarity",
    statement: "Nothing between you and the collection.",
    detail: "Transparent planes are revealed by light, never by unnecessary visual weight.",
  },
  {
    number: "03",
    title: "Retention",
    statement: "Held with precision. Released with intent.",
    detail: "Contact points appear only where the object needs support, alignment, and confidence.",
  },
  {
    number: "04",
    title: "Resolution",
    statement: "Nothing unnecessary. Every detail earns its place.",
    detail: "The layers return to one quiet object and attention resolves back to the collection.",
  },
] as const;

function stepFromProgress(progress: number) {
  if (progress < 0.27) return 0;
  if (progress < 0.5) return 1;
  if (progress < 0.73) return 2;
  return 3;
}

export function StoryMap() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const activeStepRef = useRef(0);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const section = sectionRef.current!;
    const stage = stageRef.current;
    if (!section || !stage) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isCompact = window.matchMedia("(max-width: 767px)").matches;

    function publishStep(nextStep: number) {
      if (activeStepRef.current === nextStep) return;
      activeStepRef.current = nextStep;
      setActiveStep(nextStep);
    }

    function applyMobileState(index: number, immediate = false) {
      const duration = immediate ? 0 : 0.72;
      const ease = "power3.inOut";
      const structure = section.querySelectorAll("[data-engineering-structure]");
      const shield = section.querySelectorAll("[data-engineering-shield]");
      const retention = section.querySelectorAll("[data-engineering-retention]");
      const resolution = section.querySelectorAll("[data-engineering-resolution]");
      const haloBridge = section.querySelectorAll("[data-engineering-halo-bridge]");

      if (index === 0) {
        gsap.to(structure, { x: -34, y: -6, autoAlpha: 1, duration, ease, overwrite: true });
        gsap.to(shield, { x: 8, autoAlpha: 0.2, duration, ease, overwrite: true });
        gsap.to(retention, { y: 0, autoAlpha: 0.16, duration, ease, overwrite: true });
        gsap.to(resolution, { autoAlpha: 0, duration, ease, overwrite: true });
        gsap.to(haloBridge, { autoAlpha: 0, duration, ease, overwrite: true });
      } else if (index === 1) {
        gsap.to(structure, { x: -14, y: 0, autoAlpha: 0.28, duration, ease, overwrite: true });
        gsap.to(shield, { x: 32, autoAlpha: 0.82, duration, ease, overwrite: true });
        gsap.to(retention, { y: 0, autoAlpha: 0.12, duration, ease, overwrite: true });
        gsap.to(resolution, { autoAlpha: 0, duration, ease, overwrite: true });
        gsap.to(haloBridge, { autoAlpha: 0, duration, ease, overwrite: true });
      } else if (index === 2) {
        gsap.to(structure, { x: -8, y: 0, autoAlpha: 0.22, duration, ease, overwrite: true });
        gsap.to(shield, { x: 12, autoAlpha: 0.26, duration, ease, overwrite: true });
        gsap.to(retention, { y: 30, autoAlpha: 1, duration, ease, overwrite: true });
        gsap.to(resolution, { autoAlpha: 0, duration, ease, overwrite: true });
        gsap.to(haloBridge, { autoAlpha: 0, duration, ease, overwrite: true });
      } else {
        gsap.to(structure, { x: 0, y: 0, autoAlpha: 0.74, duration, ease, overwrite: true });
        gsap.to(shield, { x: 0, autoAlpha: 0.42, duration, ease, overwrite: true });
        gsap.to(retention, { y: 0, autoAlpha: 0.58, duration, ease, overwrite: true });
        gsap.to(resolution, { autoAlpha: 1, duration, ease, overwrite: true });
        gsap.to(haloBridge, { autoAlpha: 0.5, duration: immediate ? 0 : 1, ease, overwrite: true });
      }
    }

    const context = gsap.context(() => {
      gsap.set("[data-engineering-car]", { autoAlpha: 1, x: 0, y: 0, scale: 1 });
      gsap.set("[data-engineering-structure]", { autoAlpha: 0.2, x: 0, y: 0 });
      gsap.set("[data-engineering-shield]", { autoAlpha: 0.12, x: 0 });
      gsap.set("[data-engineering-retention]", { autoAlpha: 0.08, y: 0 });
      gsap.set("[data-engineering-resolution]", { autoAlpha: 0 });
      gsap.set("[data-engineering-edge-sweep]", { autoAlpha: 0, xPercent: -120 });
      gsap.set("[data-engineering-halo-bridge]", { autoAlpha: 0 });

      if (prefersReducedMotion) {
        publishStep(3);
        applyMobileState(3, true);
        return;
      }

      if (isCompact) {
        applyMobileState(0, true);

        const panels = gsap.utils.toArray<HTMLElement>("[data-engineering-mobile-step]", section);
        panels.forEach((panel, index) => {
          ScrollTrigger.create({
            trigger: panel,
            start: "top 58%",
            end: "bottom 42%",
            onEnter: () => {
              publishStep(index);
              applyMobileState(index);
            },
            onEnterBack: () => {
              publishStep(index);
              applyMobileState(index);
            },
          });
        });

        return;
      }

      const timeline = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.7,
          invalidateOnRefresh: true,
          onUpdate: (self) => publishStep(stepFromProgress(self.progress)),
        },
      });

      timeline
        .to("[data-engineering-edge-sweep]", {
          autoAlpha: 0.74,
          xPercent: 150,
          duration: 0.8,
          ease: "power2.inOut",
        }, 0)
        .to("[data-engineering-structure]", {
          autoAlpha: 1,
          x: -78,
          y: -10,
          duration: 0.9,
          ease: "power3.inOut",
        }, 0.55)
        .to("[data-engineering-shield]", {
          autoAlpha: 0.22,
          x: 16,
          duration: 0.7,
          ease: "power3.inOut",
        }, 0.72)
        .to("[data-engineering-structure]", {
          autoAlpha: 0.3,
          x: -24,
          y: 0,
          duration: 0.65,
          ease: "power3.inOut",
        }, 1.55)
        .to("[data-engineering-shield]", {
          autoAlpha: 0.84,
          x: 72,
          duration: 0.85,
          ease: "power3.inOut",
        }, 1.55)
        .to("[data-engineering-retention]", {
          autoAlpha: 0.14,
          duration: 0.45,
        }, 1.7)
        .to("[data-engineering-structure]", {
          autoAlpha: 0.2,
          x: -12,
          duration: 0.55,
          ease: "power3.inOut",
        }, 2.55)
        .to("[data-engineering-shield]", {
          autoAlpha: 0.24,
          x: 24,
          duration: 0.55,
          ease: "power3.inOut",
        }, 2.55)
        .to("[data-engineering-retention]", {
          autoAlpha: 1,
          y: 52,
          duration: 0.8,
          ease: "power3.inOut",
        }, 2.5)
        .to("[data-engineering-structure]", {
          autoAlpha: 0.74,
          x: 0,
          y: 0,
          duration: 0.95,
          ease: "power3.inOut",
        }, 3.45)
        .to("[data-engineering-shield]", {
          autoAlpha: 0.42,
          x: 0,
          duration: 0.95,
          ease: "power3.inOut",
        }, 3.45)
        .to("[data-engineering-retention]", {
          autoAlpha: 0.58,
          y: 0,
          duration: 0.95,
          ease: "power3.inOut",
        }, 3.45)
        .to("[data-engineering-resolution]", {
          autoAlpha: 1,
          duration: 0.62,
          ease: "power2.out",
        }, 4.02)
        .to("[data-engineering-halo-bridge]", {
          autoAlpha: 0.5,
          duration: 0.72,
          ease: "power2.out",
        }, 4.18);
    }, section);

    ScrollTrigger.refresh();

    return () => {
      context.revert();
      ScrollTrigger.getAll().forEach((trigger) => {
        if (trigger.trigger && section.contains(trigger.trigger as Node)) trigger.kill();
      });
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="engineering"
      className="engineering-sequence"
      aria-labelledby="engineering-title"
      data-active-engineering-step={activeStep}
    >
      <div ref={stageRef} className="engineering-stage">
        <div className="engineering-stage__atmosphere" aria-hidden="true">
          <span className="engineering-stage__beam" />
          <span className="engineering-stage__floor" />
        </div>

        <header className="engineering-stage__header visr-container">
          <p className="visr-label">VISR / Engineering Study</p>
          <div>
            <h2 id="engineering-title">The collection remains.</h2>
            <p>Everything else steps back.</p>
          </div>
        </header>

        <div className="engineering-stage__artifact" aria-hidden="true">
          <svg className="engineering-artifact" viewBox="0 0 1200 720" role="presentation">
            <defs>
              <linearGradient id="engineering-body" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0" stopColor="#f7f7f5" stopOpacity="0.82" />
                <stop offset="0.45" stopColor="#8b8b87" stopOpacity="0.24" />
                <stop offset="1" stopColor="#f7f7f5" stopOpacity="0.48" />
              </linearGradient>
              <linearGradient id="engineering-plane" x1="0" x2="1">
                <stop offset="0" stopColor="#ffffff" stopOpacity="0.015" />
                <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.12" />
                <stop offset="1" stopColor="#ffffff" stopOpacity="0.025" />
              </linearGradient>
              <radialGradient id="engineering-wheel" cx="50%" cy="42%" r="58%">
                <stop offset="0" stopColor="#d1d1cd" stopOpacity="0.4" />
                <stop offset="0.3" stopColor="#242424" />
                <stop offset="0.74" stopColor="#070707" />
                <stop offset="1" stopColor="#000000" />
              </radialGradient>
              <filter id="engineering-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="7" />
              </filter>
              <filter id="engineering-shadow" x="-30%" y="-80%" width="160%" height="260%">
                <feGaussianBlur stdDeviation="22" />
              </filter>
            </defs>

            <ellipse cx="610" cy="568" rx="360" ry="28" fill="#000" opacity="0.66" filter="url(#engineering-shadow)" />

            <g data-engineering-shield>
              <path
                d="M170 132H1030L1092 196V518L1032 566H170L108 518V196L170 132Z"
                fill="url(#engineering-plane)"
                stroke="rgba(255,255,255,.22)"
                strokeWidth="1.5"
              />
              <path
                d="M190 154H1010L1064 208V496L1012 540H190L136 496V208L190 154Z"
                fill="none"
                stroke="rgba(255,255,255,.08)"
                strokeWidth="1"
              />
            </g>

            <g data-engineering-structure fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M170 132H1030L1092 196" stroke="rgba(255,255,255,.74)" strokeWidth="2.2" />
              <path d="M1092 196V518L1032 566" stroke="rgba(255,255,255,.3)" strokeWidth="2" />
              <path d="M1032 566H170L108 518" stroke="rgba(255,255,255,.44)" strokeWidth="2" />
              <path d="M108 518V196L170 132" stroke="rgba(255,255,255,.18)" strokeWidth="2" />
              <circle cx="170" cy="132" r="4" fill="rgba(255,255,255,.7)" stroke="none" />
              <circle cx="1092" cy="196" r="4" fill="rgba(255,255,255,.4)" stroke="none" />
            </g>

            <g data-engineering-retention fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M320 522H448L466 544H304Z" stroke="rgba(255,255,255,.54)" strokeWidth="2" />
              <path d="M752 522H880L896 544H736Z" stroke="rgba(255,255,255,.54)" strokeWidth="2" />
              <path d="M498 532H704" stroke="rgba(255,255,255,.2)" strokeWidth="1.5" strokeDasharray="7 10" />
              <path d="M384 510V548M816 510V548" stroke="rgba(255,255,255,.16)" strokeWidth="1" />
            </g>

            <g data-engineering-car>
              <path
                d="M418 372L492 288C511 267 537 256 566 256H716C746 256 772 268 790 290L856 372Z"
                fill="url(#engineering-plane)"
                stroke="rgba(255,255,255,.18)"
                strokeWidth="2"
              />
              <path
                d="M266 404C305 385 357 375 426 369L474 312C495 287 526 273 558 273H724C757 273 786 287 808 312L860 368C933 376 982 391 1007 416L1037 456C1048 470 1042 491 1024 496L960 512H304L229 496C210 492 203 469 215 454L246 417C252 411 259 407 266 404Z"
                fill="url(#engineering-body)"
                stroke="rgba(255,255,255,.26)"
                strokeWidth="2"
              />
              <path d="M302 404C452 389 745 387 958 408" fill="none" stroke="rgba(255,255,255,.42)" strokeWidth="2" strokeLinecap="round" />
              <path d="M405 369H864" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="1.5" />
              <path d="M257 442H343" stroke="rgba(255,255,255,.7)" strokeWidth="4" strokeLinecap="round" />
              <path d="M913 440H1001" stroke="rgba(255,255,255,.42)" strokeWidth="4" strokeLinecap="round" />
              <g>
                <circle cx="408" cy="493" r="67" fill="url(#engineering-wheel)" />
                <circle cx="408" cy="493" r="32" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="2" />
                <circle cx="408" cy="493" r="7" fill="rgba(255,255,255,.3)" />
              </g>
              <g>
                <circle cx="851" cy="493" r="67" fill="url(#engineering-wheel)" />
                <circle cx="851" cy="493" r="32" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="2" />
                <circle cx="851" cy="493" r="7" fill="rgba(255,255,255,.3)" />
              </g>
            </g>

            <g data-engineering-resolution fill="none" strokeLinecap="round">
              <path d="M170 132H1030L1092 196" stroke="rgba(255,255,255,.84)" strokeWidth="2.5" filter="url(#engineering-glow)" />
              <path d="M108 518L170 566H1032" stroke="rgba(255,255,255,.34)" strokeWidth="2" />
            </g>

            <g className="engineering-notation">
              <path d="M170 132H62" stroke="rgba(255,255,255,.18)" strokeWidth="1" />
              <text x="26" y="126">01 / STRUCTURE</text>
              <path d="M1092 284H1160" stroke="rgba(255,255,255,.18)" strokeWidth="1" />
              <text x="1070" y="272">02 / CLARITY</text>
              <path d="M816 544V622" stroke="rgba(255,255,255,.18)" strokeWidth="1" />
              <text x="748" y="648">03 / RETENTION</text>
            </g>

            <rect data-engineering-edge-sweep x="122" y="128" width="310" height="2" rx="1" fill="rgba(255,255,255,.88)" filter="url(#engineering-glow)" />
            <path data-engineering-halo-bridge d="M176 130H1024" stroke="rgba(161,29,42,.9)" strokeWidth="2.5" strokeLinecap="round" filter="url(#engineering-glow)" />
          </svg>
        </div>

        <div className="engineering-stage__copy visr-container" aria-live="polite">
          {engineeringSteps.map((step, index) => (
            <article key={step.number} className="engineering-copy" data-active={activeStep === index} aria-hidden={activeStep !== index}>
              <p className="visr-label">{step.number} — {step.title}</p>
              <h3>{step.statement}</h3>
              <p>{step.detail}</p>
            </article>
          ))}
        </div>

        <ol className="engineering-stage__rail" aria-label="Engineering sequence">
          {engineeringSteps.map((step, index) => (
            <li key={step.number} data-active={activeStep === index}>
              <span>{step.number}</span>
              <span>{step.title}</span>
            </li>
          ))}
        </ol>

        <p className="engineering-stage__resolution" data-active={activeStep === 3}>
          Engineered to elevate.
        </p>
      </div>

      <div className="engineering-mobile-steps">
        {engineeringSteps.map((step, index) => (
          <article key={step.number} className="engineering-mobile-step visr-container" data-engineering-mobile-step>
            <div data-active={activeStep === index}>
              <p className="visr-label">{step.number} / 04 — {step.title}</p>
              <h3>{step.statement}</h3>
              <p>{step.detail}</p>
            </div>
          </article>
        ))}
      </div>

      <style jsx global>{`
        .engineering-sequence {
          position: relative;
          min-height: 520svh;
          border-top: 1px solid rgb(255 255 255 / 0.07);
          background: #030303;
        }

        .engineering-stage {
          position: sticky;
          top: 0;
          height: 100svh;
          overflow: hidden;
          isolation: isolate;
          background:
            radial-gradient(circle at 58% 44%, rgb(255 255 255 / 0.045), transparent 24rem),
            linear-gradient(180deg, #040404 0%, #020202 72%, #050505 100%);
        }

        .engineering-stage__atmosphere {
          position: absolute;
          inset: 0;
          z-index: -2;
          pointer-events: none;
        }

        .engineering-stage__beam {
          position: absolute;
          top: 17%;
          left: 14%;
          width: 72%;
          height: 1px;
          opacity: 0.26;
          background: linear-gradient(90deg, transparent, rgb(255 255 255 / 0.72), transparent);
          box-shadow: 0 0 72px 18px rgb(255 255 255 / 0.08);
          filter: blur(0.4px);
        }

        .engineering-stage__floor {
          position: absolute;
          right: 4%;
          bottom: 5%;
          left: 4%;
          height: 28%;
          opacity: 0.6;
          background: radial-gradient(ellipse at 54% 0%, rgb(255 255 255 / 0.07), transparent 56%);
          transform: perspective(820px) rotateX(68deg);
          transform-origin: center top;
        }

        .engineering-stage__header {
          position: absolute;
          inset: 0;
          z-index: 4;
          display: grid;
          grid-template-columns: repeat(12, minmax(0, 1fr));
          align-content: start;
          gap: 1rem;
          padding-top: clamp(6.5rem, 12vh, 9rem);
          pointer-events: none;
        }

        .engineering-stage__header > p {
          grid-column: span 3;
          margin: 0;
          color: rgb(247 247 245 / 0.36);
        }

        .engineering-stage__header > div {
          grid-column: 5 / span 7;
        }

        .engineering-stage__header h2,
        .engineering-stage__header div > p {
          max-width: 12ch;
          margin: 0;
          font-weight: 400;
          line-height: 0.98;
          letter-spacing: -0.047em;
        }

        .engineering-stage__header h2 {
          font-size: clamp(2.5rem, 5vw, 5.9rem);
        }

        .engineering-stage__header div > p {
          margin-top: 0.08em;
          color: rgb(247 247 245 / 0.35);
          font-size: clamp(1.75rem, 3.6vw, 4.4rem);
        }

        .engineering-stage__artifact {
          position: absolute;
          top: 51%;
          left: 54%;
          width: min(76rem, 79vw);
          transform: translate(-50%, -50%);
          transform-origin: center;
        }

        .engineering-artifact {
          display: block;
          width: 100%;
          height: auto;
          overflow: visible;
          filter: drop-shadow(0 34px 52px rgb(0 0 0 / 0.72));
        }

        .engineering-artifact [data-engineering-car],
        .engineering-artifact [data-engineering-structure],
        .engineering-artifact [data-engineering-shield],
        .engineering-artifact [data-engineering-retention],
        .engineering-artifact [data-engineering-resolution],
        .engineering-artifact [data-engineering-edge-sweep],
        .engineering-artifact [data-engineering-halo-bridge] {
          will-change: transform, opacity;
        }

        .engineering-notation {
          fill: rgb(247 247 245 / 0.32);
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.13em;
        }

        .engineering-stage__copy {
          position: absolute;
          inset: auto 0 clamp(3rem, 7vh, 5.5rem);
          z-index: 5;
          min-height: 9rem;
          pointer-events: none;
        }

        .engineering-copy {
          position: absolute;
          bottom: 0;
          left: var(--page-gutter);
          width: min(35rem, calc(100vw - (2 * var(--page-gutter))));
          opacity: 0;
          transform: translateY(20px);
          transition:
            opacity 520ms var(--ease-product),
            transform 620ms var(--ease-product);
        }

        .engineering-copy[data-active="true"] {
          opacity: 1;
          transform: translateY(0);
        }

        .engineering-copy .visr-label {
          margin: 0 0 1rem;
          color: rgb(247 247 245 / 0.4);
        }

        .engineering-copy h3 {
          max-width: 16ch;
          margin: 0;
          font-size: clamp(1.8rem, 3vw, 3.5rem);
          font-weight: 400;
          line-height: 1;
          letter-spacing: -0.04em;
        }

        .engineering-copy > p:last-child {
          max-width: 34rem;
          margin: 1rem 0 0;
          color: rgb(247 247 245 / 0.42);
          font-size: 0.95rem;
          line-height: 1.55;
        }

        .engineering-stage__rail {
          position: absolute;
          right: var(--page-gutter);
          bottom: clamp(3rem, 7vh, 5.5rem);
          z-index: 5;
          display: grid;
          width: min(18rem, 22vw);
          gap: 0;
          margin: 0;
          padding: 0;
          border-top: 1px solid rgb(255 255 255 / 0.08);
          list-style: none;
        }

        .engineering-stage__rail li {
          display: grid;
          grid-template-columns: 2.5rem 1fr;
          gap: 0.75rem;
          padding: 0.8rem 0;
          border-bottom: 1px solid rgb(255 255 255 / 0.08);
          color: rgb(247 247 245 / 0.24);
          font-family: var(--font-mono);
          font-size: 0.65rem;
          letter-spacing: 0.11em;
          text-transform: uppercase;
          transition: color 420ms ease;
        }

        .engineering-stage__rail li[data-active="true"] {
          color: rgb(247 247 245 / 0.82);
        }

        .engineering-stage__rail li span:first-child {
          color: rgb(247 247 245 / 0.28);
        }

        .engineering-stage__resolution {
          position: absolute;
          right: var(--page-gutter);
          bottom: 1.2rem;
          z-index: 5;
          margin: 0;
          color: rgb(247 247 245 / 0.36);
          font-size: 0.75rem;
          letter-spacing: 0.02em;
          opacity: 0;
          transform: translateY(8px);
          transition:
            opacity 700ms var(--ease-product),
            transform 700ms var(--ease-product);
        }

        .engineering-stage__resolution[data-active="true"] {
          opacity: 1;
          transform: translateY(0);
        }

        .engineering-mobile-steps {
          display: none;
        }

        @media (max-width: 767px) {
          .engineering-sequence {
            min-height: auto;
          }

          .engineering-stage {
            height: 100svh;
          }

          .engineering-stage__header {
            display: block;
            padding-top: 5.75rem;
          }

          .engineering-stage__header > p {
            margin-bottom: 0.9rem;
          }

          .engineering-stage__header > div {
            width: 100%;
          }

          .engineering-stage__header h2 {
            max-width: 11ch;
            font-size: clamp(2.55rem, 11.5vw, 4.5rem);
          }

          .engineering-stage__header div > p {
            max-width: 12ch;
            font-size: clamp(1.75rem, 8vw, 3.2rem);
          }

          .engineering-stage__artifact {
            top: 45%;
            left: 58%;
            width: 164vw;
          }

          .engineering-notation {
            display: none;
          }

          .engineering-stage__copy,
          .engineering-stage__rail,
          .engineering-stage__resolution {
            display: none;
          }

          .engineering-mobile-steps {
            position: relative;
            z-index: 4;
            display: block;
            margin-top: -100svh;
            pointer-events: none;
          }

          .engineering-mobile-step {
            display: flex;
            min-height: 100svh;
            align-items: flex-end;
            padding-bottom: 3.1rem;
          }

          .engineering-mobile-step > div {
            width: 100%;
            padding: 1.4rem 0 0;
            border-top: 1px solid rgb(255 255 255 / 0.12);
            opacity: 0.28;
            transform: translateY(16px);
            transition:
              opacity 460ms var(--ease-product),
              transform 560ms var(--ease-product);
          }

          .engineering-mobile-step > div[data-active="true"] {
            opacity: 1;
            transform: translateY(0);
          }

          .engineering-mobile-step .visr-label {
            margin: 0 0 0.9rem;
            color: rgb(247 247 245 / 0.42);
          }

          .engineering-mobile-step h3 {
            max-width: 14ch;
            margin: 0;
            font-size: clamp(2rem, 9.5vw, 3.4rem);
            font-weight: 400;
            line-height: 0.98;
            letter-spacing: -0.045em;
          }

          .engineering-mobile-step div > p:last-child {
            max-width: 29rem;
            margin: 0.9rem 0 0;
            color: rgb(247 247 245 / 0.44);
            font-size: 0.9rem;
            line-height: 1.55;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .engineering-sequence {
            min-height: 100svh;
          }

          .engineering-stage {
            position: relative;
          }

          .engineering-mobile-steps {
            display: none;
          }
        }
      `}</style>
    </section>
  );
}
