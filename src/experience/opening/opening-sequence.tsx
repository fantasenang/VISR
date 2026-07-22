"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { OpeningArtifact } from "./opening-artifact";
import { OpeningSoundControl } from "./opening-sound-control";

const INTRO_STORAGE_KEY = "visr-opening-seen";

function playMechanicalClick() {
  const AudioContextClass = window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextClass) return;

  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const filter = context.createBiquadFilter();

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(1180, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(145, context.currentTime + 0.065);

  filter.type = "lowpass";
  filter.frequency.setValueAtTime(2600, context.currentTime);
  filter.frequency.exponentialRampToValueAtTime(420, context.currentTime + 0.07);

  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.085);

  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.09);
  oscillator.addEventListener("ended", () => void context.close());
}

export function OpeningSequence() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const soundEnabledRef = useRef(false);
  const clickPlayedRef = useRef(false);
  const revealDispatchedRef = useRef(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [returningVisitor, setReturningVisitor] = useState(false);

  useEffect(() => {
    setReturningVisitor(window.sessionStorage.getItem(INTRO_STORAGE_KEY) === "true");
  }, []);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    if (!section || !stage) return;

    gsap.registerPlugin(ScrollTrigger);

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isCompact = window.matchMedia("(max-width: 767px)").matches;

    const context = gsap.context(() => {
      if (prefersReducedMotion) {
        gsap.set("[data-opening-reveal]", { autoAlpha: 1, y: 0 });
        gsap.set("[data-opening-artifact]", { autoAlpha: 1, scale: 1 });
        gsap.set("[data-opening-frame]", { autoAlpha: 1 });
        return;
      }

      const fullDistance = returningVisitor ? 1.35 : isCompact ? 2.05 : 2.75;
      section.style.setProperty("--opening-scroll-distance", `${fullDistance * 100}svh`);

      gsap.set("[data-opening-frame]", { autoAlpha: 0.08 });
      gsap.set("[data-frame-line]", { strokeDasharray: 1, strokeDashoffset: 1 });
      gsap.set("[data-frame-highlight]", { strokeDasharray: 1, strokeDashoffset: 1, autoAlpha: 0 });
      gsap.set("[data-opening-car]", {
        autoAlpha: 0.18,
        scale: returningVisitor ? 1.12 : 1.72,
        xPercent: returningVisitor ? 0 : 16,
        transformOrigin: "58% 58%",
      });
      gsap.set("[data-car-body-line]", { strokeDasharray: 1, strokeDashoffset: 1 });
      gsap.set("[data-opening-reflection]", { autoAlpha: 0, xPercent: -12 });
      gsap.set("[data-opening-copy-primary]", { autoAlpha: 0, y: 34 });
      gsap.set("[data-opening-copy-secondary]", { autoAlpha: 0, y: 26 });
      gsap.set("[data-opening-signature]", { autoAlpha: 0, y: 14 });
      gsap.set("[data-opening-scroll-hint]", { autoAlpha: returningVisitor ? 0 : 1 });

      const timeline = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "bottom bottom",
          scrub: returningVisitor ? 0.35 : 0.65,
          invalidateOnRefresh: true,
          onUpdate: ({ progress }) => {
            stage.style.setProperty("--opening-progress", progress.toFixed(4));
            document.documentElement.style.setProperty("--opening-progress", progress.toFixed(4));

            if (progress > 0.38 && soundEnabledRef.current && !clickPlayedRef.current) {
              clickPlayedRef.current = true;
              playMechanicalClick();
            }

            if (progress > 0.72 && !revealDispatchedRef.current) {
              revealDispatchedRef.current = true;
              window.sessionStorage.setItem(INTRO_STORAGE_KEY, "true");
              window.dispatchEvent(new CustomEvent("visr:opening-revealed"));
            }
          },
          onLeaveBack: () => {
            clickPlayedRef.current = false;
            revealDispatchedRef.current = false;
            window.dispatchEvent(new CustomEvent("visr:opening-hidden"));
          },
        },
      });

      timeline
        .to("[data-opening-scroll-hint]", { autoAlpha: 0, duration: 0.06 }, 0.02)
        .to("[data-opening-car]", {
          autoAlpha: 1,
          scale: 1.06,
          xPercent: 0,
          duration: 0.38,
          ease: "power2.out",
        }, 0.02)
        .to("[data-car-body-line]", { strokeDashoffset: 0, duration: 0.24 }, 0.08)
        .to("[data-opening-reflection]", { autoAlpha: 0.64, xPercent: 10, duration: 0.3 }, 0.12)
        .to("[data-opening-frame]", { autoAlpha: 1, duration: 0.2 }, 0.29)
        .to("[data-frame-line]", { strokeDashoffset: 0, duration: 0.3, ease: "power1.inOut" }, 0.3)
        .to("[data-frame-highlight]", {
          strokeDashoffset: 0,
          autoAlpha: 1,
          duration: 0.22,
          ease: "power2.out",
        }, 0.34)
        .to("[data-opening-artifact]", {
          scale: isCompact ? 0.84 : 0.92,
          yPercent: isCompact ? -9 : -5,
          duration: 0.28,
          ease: "power2.inOut",
        }, 0.47)
        .to("[data-opening-copy-primary]", {
          autoAlpha: 1,
          y: 0,
          duration: 0.18,
          ease: "power2.out",
        }, 0.56)
        .to("[data-opening-copy-secondary]", {
          autoAlpha: 1,
          y: 0,
          duration: 0.18,
          ease: "power2.out",
        }, 0.65)
        .to("[data-opening-signature]", {
          autoAlpha: 1,
          y: 0,
          duration: 0.14,
          ease: "power2.out",
        }, 0.75);
    }, section);

    return () => {
      context.revert();
      section.style.removeProperty("--opening-scroll-distance");
      document.documentElement.style.removeProperty("--opening-progress");
    };
  }, [returningVisitor]);

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const normalizedX = (event.clientX - bounds.left) / bounds.width - 0.5;
    const normalizedY = (event.clientY - bounds.top) / bounds.height - 0.5;

    event.currentTarget.style.setProperty("--pointer-x", normalizedX.toFixed(3));
    event.currentTarget.style.setProperty("--pointer-y", normalizedY.toFixed(3));
  }

  function handlePointerLeave(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.style.setProperty("--pointer-x", "0");
    event.currentTarget.style.setProperty("--pointer-y", "0");
  }

  function handleSoundToggle() {
    setSoundEnabled((current) => {
      const next = !current;
      if (next) playMechanicalClick();
      return next;
    });
  }

  function handleSkipIntro() {
    window.sessionStorage.setItem(INTRO_STORAGE_KEY, "true");
    window.dispatchEvent(new CustomEvent("visr:opening-revealed"));
    document.querySelector("#visr")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section
      ref={sectionRef}
      id="opening"
      className="opening-sequence"
      aria-labelledby="opening-title"
      data-returning={returningVisitor ? "true" : "false"}
    >
      <div
        ref={stageRef}
        className="opening-stage"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <div className="opening-stage__atmosphere" aria-hidden="true">
          <span className="opening-stage__light opening-stage__light--primary" />
          <span className="opening-stage__light opening-stage__light--edge" />
          <span className="opening-stage__floor" />
        </div>

        <div className="opening-stage__utility">
          <OpeningSoundControl enabled={soundEnabled} onToggle={handleSoundToggle} />
          <button type="button" className="opening-skip" onClick={handleSkipIntro}>
            Skip intro
          </button>
        </div>

        <div className="opening-stage__artifact" data-opening-artifact>
          <OpeningArtifact className="opening-artifact" />
        </div>

        <div className="opening-stage__copy visr-container">
          <p className="visr-label opening-stage__eyebrow" data-opening-signature>
            VISR Display System
          </p>
          <h1 id="opening-title" className="opening-stage__headline" data-opening-copy-primary>
            Designed to disappear.
          </h1>
          <p className="opening-stage__subheadline" data-opening-copy-secondary>
            Engineered to elevate.
          </p>
          <p className="opening-stage__signature" data-opening-signature>
            The collection is always the hero.
          </p>
        </div>

        <div className="opening-stage__scroll" data-opening-scroll-hint aria-hidden="true">
          <span />
          <p>Scroll to reveal</p>
        </div>
      </div>
    </section>
  );
}
