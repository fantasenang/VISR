"use client";

import { useEffect, useRef, type PointerEvent } from "react";
import gsap from "gsap";
import { OpeningArtifact } from "./opening-artifact";

const WHEEL_DISTANCE_DESKTOP = 760;
const WHEEL_DISTANCE_MOBILE = 430;
const KEYBOARD_STEP = 0.22;
const SOUND_TRIGGER_PROGRESS = 0.58;

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
  const clickPlayedRef = useRef(false);
  const revealDispatchedRef = useRef(false);
  const introFinishedRef = useRef(false);

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
      gsap.set("[data-opening-artifact]", { autoAlpha: 1 });
      gsap.set("[data-opening-h01]", {
        autoAlpha: 0,
        scale: 1.085,
        filter: "blur(16px)",
        transformOrigin: "50% 54%",
      });
      gsap.set("[data-opening-h02]", {
        autoAlpha: 0,
        scale: 0.965,
        filter: "blur(0px)",
        transformOrigin: "50% 50%",
      });
      gsap.set("[data-opening-intro-copy]", { autoAlpha: 0, y: 24 });
      gsap.set("[data-opening-reveal-copy]", { autoAlpha: 0, y: 18 });
      gsap.set("[data-opening-scroll-hint]", { autoAlpha: 1 });
      gsap.set("[data-opening-reflection]", { autoAlpha: 0, xPercent: -16 });
      publishProgress(0);

      if (prefersReducedMotion) {
        gsap.set("[data-opening-h01]", { autoAlpha: 0, scale: 1, filter: "blur(0px)" });
        gsap.set("[data-opening-h02]", { autoAlpha: 1, scale: 1 });
        gsap.set("[data-opening-intro-copy]", { autoAlpha: 0 });
        gsap.set("[data-opening-reveal-copy]", { autoAlpha: 1, y: 0 });
        gsap.set("[data-opening-scroll-hint]", { autoAlpha: 0 });
        publishProgress(1);
        dispatchReveal();
        return;
      }

      const timeline = gsap.timeline({
        paused: true,
        defaults: { force3D: true },
        onUpdate: () => publishProgress(timeline.progress()),
        onComplete: dispatchReveal,
      });

      timelineRef.current = timeline;

      timeline
        .to("[data-opening-h01]", {
          autoAlpha: 0.46,
          scale: 1.065,
          filter: "blur(11px)",
          duration: 0.16,
          ease: "power2.out",
        }, 0.03)
        .to("[data-opening-h01]", {
          autoAlpha: 0.90,
          scale: 1.025,
          filter: "blur(2.4px)",
          duration: 0.30,
          ease: "power2.out",
        }, 0.14)
        .to("[data-opening-scroll-hint]", {
          autoAlpha: 0,
          duration: 0.10,
          ease: "power2.out",
        }, 0.22)
        .to("[data-opening-intro-copy]", {
          autoAlpha: 1,
          y: 0,
          duration: 0.18,
          stagger: 0.04,
          ease: "power3.out",
        }, 0.24)
        .to("[data-opening-intro-copy]", {
          autoAlpha: 0,
          y: -12,
          duration: 0.16,
          stagger: 0.02,
          ease: "power2.in",
        }, 0.46)
        .to("[data-opening-h01]", {
          autoAlpha: 0,
          scale: 0.985,
          filter: "blur(5px)",
          duration: 0.30,
          ease: "power2.inOut",
        }, 0.53)
        .to("[data-opening-h02]", {
          autoAlpha: 1,
          scale: 1,
          duration: 0.38,
          ease: "power3.out",
        }, 0.55)
        .to("[data-opening-reflection]", {
          autoAlpha: 0.42,
          xPercent: 18,
          duration: 0.30,
          ease: "power2.out",
        }, 0.61)
        .to("[data-opening-reveal-copy]", {
          autoAlpha: 1,
          y: 0,
          duration: 0.20,
          stagger: 0.05,
          ease: "power3.out",
        }, 0.82)
        .to({}, { duration: 0.16 });
    }, section);

    function moveTimeline(deltaProgress: number) {
      const timeline = timelineRef.current;
      if (!timeline || introFinishedRef.current) return;

      const previousProgress = targetProgressRef.current;
      const nextProgress = Math.min(1, Math.max(0, previousProgress + deltaProgress));
      targetProgressRef.current = nextProgress;

      // Triggered directly from the user's scroll/swipe gesture so mobile browsers
      // permit audio without requiring a visible sound toggle.
      if (
        previousProgress < SOUND_TRIGGER_PROGRESS &&
        nextProgress >= SOUND_TRIGGER_PROGRESS &&
        !clickPlayedRef.current
      ) {
        clickPlayedRef.current = true;
        playMechanicalClick();
      }

      progressTweenRef.current?.kill();
      progressTweenRef.current = gsap.to(timeline, {
        progress: nextProgress,
        duration: isCompact ? 0.24 : 0.38,
        ease: "power2.out",
        overwrite: true,
        onComplete: () => {
          progressTweenRef.current = null;
          if (nextProgress >= 1) dispatchReveal();
        },
      });
    }

    function handleWheel(event: WheelEvent) {
      if (introFinishedRef.current || event.deltaY <= 0) return;
      event.preventDefault();
      moveTimeline(Math.min(0.24, Math.abs(event.deltaY) / interactionDistance));
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
      moveTimeline(Math.min(0.22, upwardDistance / interactionDistance));
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

        <div className="opening-stage__artifact" data-opening-artifact style={{ opacity: 0 }}>
          <OpeningArtifact className="opening-artifact" />
        </div>

        <div className="opening-stage__copy opening-stage__copy--intro visr-container">
          <h1 id="opening-title" className="opening-stage__headline" data-opening-intro-copy style={{ opacity: 0 }}>
            Designed to Carry.
          </h1>
          <p className="opening-stage__subheadline" data-opening-intro-copy style={{ opacity: 0 }}>
            Engineered to Display.
          </p>
        </div>

        <div className="opening-stage__copy opening-stage__copy--reveal visr-container">
          <p className="visr-label opening-stage__eyebrow" data-opening-reveal-copy style={{ opacity: 0 }}>
            VISR Carry
          </p>
          <p className="opening-stage__reveal-line" data-opening-reveal-copy style={{ opacity: 0 }}>
            The first magnetic diecast display system.
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
