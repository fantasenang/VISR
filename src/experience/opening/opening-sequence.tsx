"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import gsap from "gsap";
import { OpeningArtifact } from "./opening-artifact";
import { OpeningSoundControl } from "./opening-sound-control";

const WHEEL_DISTANCE_DESKTOP = 920;
const WHEEL_DISTANCE_MOBILE = 620;
const KEYBOARD_STEP = 0.2;

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
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const progressTweenRef = useRef<gsap.core.Tween | null>(null);
  const targetProgressRef = useRef(0);
  const touchLastYRef = useRef<number | null>(null);
  const soundEnabledRef = useRef(false);
  const clickPlayedRef = useRef(false);
  const revealDispatchedRef = useRef(false);
  const introFinishedRef = useRef(false);
  const [soundEnabled, setSoundEnabled] = useState(false);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    if (!section || !stage) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isCompact = window.matchMedia("(max-width: 767px)").matches;
    const interactionDistance = isCompact ? WHEEL_DISTANCE_MOBILE : WHEEL_DISTANCE_DESKTOP;

    targetProgressRef.current = 0;
    introFinishedRef.current = false;
    revealDispatchedRef.current = false;
    clickPlayedRef.current = false;

    function publishProgress(progress: number) {
      const value = progress.toFixed(4);
      stageRef.current?.style.setProperty("--opening-progress", value);
      document.documentElement.style.setProperty("--opening-progress", value);
    }

    function dispatchReveal() {
      if (revealDispatchedRef.current) return;
      revealDispatchedRef.current = true;
      introFinishedRef.current = true;
      window.dispatchEvent(new CustomEvent("visr:opening-revealed"));
    }

    const context = gsap.context(() => {
      gsap.set("[data-opening-artifact]", { autoAlpha: 1, scale: 1, yPercent: 0 });
      gsap.set("[data-opening-frame]", { autoAlpha: 0 });
      gsap.set("[data-frame-line]", { strokeDasharray: 1, strokeDashoffset: 1 });
      gsap.set("[data-frame-highlight]", { strokeDasharray: 1, strokeDashoffset: 1, autoAlpha: 0 });
      gsap.set("[data-opening-car]", {
        autoAlpha: 0,
        scale: isCompact ? 1.82 : 2.05,
        xPercent: isCompact ? 5 : 18,
        transformOrigin: "58% 58%",
      });
      gsap.set("[data-car-body-line]", { strokeDasharray: 1, strokeDashoffset: 1 });
      gsap.set("[data-opening-reflection]", { autoAlpha: 0, xPercent: -14 });
      gsap.set("[data-opening-copy-primary]", { autoAlpha: 0, y: 34 });
      gsap.set("[data-opening-copy-secondary]", { autoAlpha: 0, y: 26 });
      gsap.set("[data-opening-signature]", { autoAlpha: 0, y: 14 });
      gsap.set("[data-opening-scroll-hint]", { autoAlpha: 1 });
      publishProgress(0);

      if (prefersReducedMotion) {
        gsap.set("[data-opening-car]", { autoAlpha: 1, scale: 1.06, xPercent: 0 });
        gsap.set("[data-opening-frame]", { autoAlpha: 1 });
        gsap.set("[data-frame-line], [data-frame-highlight], [data-car-body-line]", {
          strokeDashoffset: 0,
          autoAlpha: 1,
        });
        gsap.set("[data-opening-reflection]", { autoAlpha: 0.64, xPercent: 10 });
        gsap.set("[data-opening-artifact]", {
          autoAlpha: 1,
          scale: isCompact ? 0.84 : 0.92,
          yPercent: isCompact ? -9 : -5,
        });
        gsap.set("[data-opening-copy-primary], [data-opening-copy-secondary], [data-opening-signature]", {
          autoAlpha: 1,
          y: 0,
        });
        gsap.set("[data-opening-scroll-hint]", { autoAlpha: 0 });
        publishProgress(1);
        dispatchReveal();
        return;
      }

      const timeline = gsap.timeline({
        paused: true,
        defaults: { force3D: true },
        onUpdate: () => {
          const progress = timeline.progress();
          publishProgress(progress);

          if (progress > 0.43 && soundEnabledRef.current && !clickPlayedRef.current) {
            clickPlayedRef.current = true;
            playMechanicalClick();
          }

          if (progress < 0.36) clickPlayedRef.current = false;
        },
        onComplete: dispatchReveal,
      });

      timelineRef.current = timeline;

      timeline
        // A deliberate dead zone: nothing reveals on page load or accidental micro-scroll.
        .to({}, { duration: 0.12 })
        .to("[data-opening-scroll-hint]", {
          autoAlpha: 0,
          duration: 0.08,
          ease: "power2.out",
        }, 0.1)
        .to("[data-opening-car]", {
          autoAlpha: 1,
          scale: 1.06,
          xPercent: 0,
          duration: 0.38,
          ease: "power3.out",
        }, 0.16)
        .to("[data-car-body-line]", {
          strokeDashoffset: 0,
          duration: 0.26,
          ease: "power2.out",
        }, 0.28)
        .to("[data-opening-reflection]", {
          autoAlpha: 0.64,
          xPercent: 10,
          duration: 0.32,
          ease: "power2.out",
        }, 0.32)
        .to("[data-opening-frame]", {
          autoAlpha: 1,
          duration: 0.24,
          ease: "power2.out",
        }, 0.48)
        .to("[data-frame-line]", {
          strokeDashoffset: 0,
          duration: 0.34,
          ease: "power2.inOut",
        }, 0.5)
        .to("[data-frame-highlight]", {
          strokeDashoffset: 0,
          autoAlpha: 1,
          duration: 0.28,
          ease: "power3.out",
        }, 0.57)
        .to("[data-opening-artifact]", {
          scale: isCompact ? 0.84 : 0.92,
          yPercent: isCompact ? -9 : -5,
          duration: 0.3,
          ease: "power3.inOut",
        }, 0.66)
        .to("[data-opening-copy-primary]", {
          autoAlpha: 1,
          y: 0,
          duration: 0.22,
          ease: "power3.out",
        }, 0.78)
        .to("[data-opening-copy-secondary]", {
          autoAlpha: 1,
          y: 0,
          duration: 0.2,
          ease: "power3.out",
        }, 0.86)
        .to("[data-opening-signature]", {
          autoAlpha: 1,
          y: 0,
          duration: 0.16,
          ease: "power2.out",
        }, 0.94);
    }, section);

    function moveTimeline(deltaProgress: number) {
      const timeline = timelineRef.current;
      if (!timeline || introFinishedRef.current) return;

      targetProgressRef.current = Math.min(1, Math.max(0, targetProgressRef.current + deltaProgress));
      progressTweenRef.current?.kill();
      progressTweenRef.current = gsap.to(timeline, {
        progress: targetProgressRef.current,
        duration: isCompact ? 0.36 : 0.48,
        ease: "power2.out",
        overwrite: true,
        onComplete: () => {
          progressTweenRef.current = null;
          if (targetProgressRef.current >= 1) dispatchReveal();
        },
      });
    }

    function handleWheel(event: WheelEvent) {
      if (introFinishedRef.current || event.deltaY <= 0) return;
      event.preventDefault();
      moveTimeline(Math.min(0.18, Math.abs(event.deltaY) / interactionDistance));
    }

    function handleTouchStart(event: TouchEvent) {
      touchLastYRef.current = event.touches[0]?.clientY ?? null;
    }

    function handleTouchMove(event: TouchEvent) {
      if (introFinishedRef.current || touchLastYRef.current === null) return;

      const currentY = event.touches[0]?.clientY;
      if (currentY === undefined) return;

      const upwardDistance = touchLastYRef.current - currentY;
      touchLastYRef.current = currentY;
      if (upwardDistance <= 0) return;

      event.preventDefault();
      moveTimeline(Math.min(0.14, upwardDistance / interactionDistance));
    }

    function handleTouchEnd() {
      touchLastYRef.current = null;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (introFinishedRef.current || !["ArrowDown", "PageDown", " ", "End"].includes(event.key)) return;
      event.preventDefault();
      moveTimeline(event.key === "End" ? 1 : KEYBOARD_STEP);
    }

    section.addEventListener("wheel", handleWheel, { passive: false });
    section.addEventListener("touchstart", handleTouchStart, { passive: true });
    section.addEventListener("touchmove", handleTouchMove, { passive: false });
    section.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      section.removeEventListener("wheel", handleWheel);
      section.removeEventListener("touchstart", handleTouchStart);
      section.removeEventListener("touchmove", handleTouchMove);
      section.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("keydown", handleKeyDown);
      progressTweenRef.current?.kill();
      progressTweenRef.current = null;
      timelineRef.current = null;
      context.revert();
      document.documentElement.style.removeProperty("--opening-progress");
    };
  }, []);

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
    const timeline = timelineRef.current;
    progressTweenRef.current?.kill();

    if (timeline) {
      progressTweenRef.current = gsap.to(timeline, {
        progress: 1,
        duration: 0.32,
        ease: "power3.out",
        overwrite: true,
        onComplete: () => {
          introFinishedRef.current = true;
          if (!revealDispatchedRef.current) {
            revealDispatchedRef.current = true;
            window.dispatchEvent(new CustomEvent("visr:opening-revealed"));
          }
          document.querySelector("#visr")?.scrollIntoView({ behavior: "smooth", block: "start" });
        },
      });
      return;
    }

    window.dispatchEvent(new CustomEvent("visr:opening-revealed"));
    document.querySelector("#visr")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section
      ref={sectionRef}
      id="opening"
      className="opening-sequence"
      aria-labelledby="opening-title"
      data-returning="false"
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

        <div className="opening-stage__artifact" data-opening-artifact style={{ opacity: 0 }}>
          <OpeningArtifact className="opening-artifact" />
        </div>

        <div className="opening-stage__copy visr-container">
          <p className="visr-label opening-stage__eyebrow" data-opening-signature style={{ opacity: 0 }}>
            VISR Display System
          </p>
          <h1
            id="opening-title"
            className="opening-stage__headline"
            data-opening-copy-primary
            style={{ opacity: 0 }}
          >
            Designed to disappear.
          </h1>
          <p className="opening-stage__subheadline" data-opening-copy-secondary style={{ opacity: 0 }}>
            Engineered to elevate.
          </p>
          <p className="opening-stage__signature" data-opening-signature style={{ opacity: 0 }}>
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
