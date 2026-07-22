"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import gsap from "gsap";
import { OpeningArtifact } from "./opening-artifact";
import { OpeningSoundControl } from "./opening-sound-control";

const INTRO_STORAGE_KEY = "visr-opening-seen";
const FAST_SCROLL_THRESHOLD = 88;

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
  const accelerationTweenRef = useRef<gsap.core.Tween | null>(null);
  const soundEnabledRef = useRef(false);
  const clickPlayedRef = useRef(false);
  const revealDispatchedRef = useRef(false);
  const introFinishedRef = useRef(false);
  const pendingAdvanceRef = useRef(false);
  const scrollIntentRef = useRef(0);
  const touchStartYRef = useRef<number | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [returningVisitor, setReturningVisitor] = useState(false);
  const [visitorStateReady, setVisitorStateReady] = useState(false);

  useEffect(() => {
    setReturningVisitor(window.sessionStorage.getItem(INTRO_STORAGE_KEY) === "true");
    setVisitorStateReady(true);
  }, []);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    if (!visitorStateReady) return;

    const section = sectionRef.current;
    const stage = stageRef.current;
    if (!section || !stage) return;
    const stageElement = stage;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isCompact = window.matchMedia("(max-width: 767px)").matches;
    let advanceTimer: number | undefined;

    introFinishedRef.current = false;
    revealDispatchedRef.current = false;
    clickPlayedRef.current = false;
    pendingAdvanceRef.current = false;
    scrollIntentRef.current = 0;

    function publishProgress(progress: number) {
      const value = progress.toFixed(4);
      stageElement.style.setProperty("--opening-progress", value);
      document.documentElement.style.setProperty("--opening-progress", value);
    }

    function dispatchReveal() {
      if (revealDispatchedRef.current) return;

      revealDispatchedRef.current = true;
      introFinishedRef.current = true;
      window.sessionStorage.setItem(INTRO_STORAGE_KEY, "true");
      window.dispatchEvent(new CustomEvent("visr:opening-revealed"));
    }

    function advanceToContent() {
      if (!pendingAdvanceRef.current) return;

      advanceTimer = window.setTimeout(() => {
        document.querySelector("#visr")?.scrollIntoView({
          behavior: prefersReducedMotion ? "auto" : "smooth",
          block: "start",
        });
      }, prefersReducedMotion ? 0 : 220);
    }

    function finishOpening() {
      publishProgress(1);
      dispatchReveal();
      advanceToContent();
    }

    const context = gsap.context(() => {
      gsap.set("[data-opening-frame]", { autoAlpha: returningVisitor ? 0.2 : 0.12 });
      gsap.set("[data-frame-line]", { strokeDasharray: 1, strokeDashoffset: 1 });
      gsap.set("[data-frame-highlight]", { strokeDasharray: 1, strokeDashoffset: 1, autoAlpha: 0 });
      gsap.set("[data-opening-car]", {
        autoAlpha: returningVisitor ? 0.48 : 0.34,
        scale: returningVisitor ? 1.12 : isCompact ? 1.24 : 1.32,
        xPercent: isCompact ? 0 : 3,
        transformOrigin: "58% 58%",
      });
      gsap.set("[data-car-body-line]", { strokeDasharray: 1, strokeDashoffset: 1 });
      gsap.set("[data-opening-reflection]", { autoAlpha: 0.08, xPercent: -8 });
      gsap.set("[data-opening-copy-primary]", { autoAlpha: 0, y: 28 });
      gsap.set("[data-opening-copy-secondary]", { autoAlpha: 0, y: 22 });
      gsap.set("[data-opening-signature]", { autoAlpha: 0, y: 12 });
      gsap.set("[data-opening-scroll-hint]", { autoAlpha: 0 });
      publishProgress(returningVisitor ? 0.12 : 0.07);

      if (prefersReducedMotion || window.scrollY > 40) {
        gsap.set("[data-opening-car]", { autoAlpha: 1, scale: 1.06, xPercent: 0 });
        gsap.set("[data-opening-frame]", { autoAlpha: 1 });
        gsap.set("[data-frame-line], [data-frame-highlight], [data-car-body-line]", {
          strokeDashoffset: 0,
          autoAlpha: 1,
        });
        gsap.set("[data-opening-reflection]", { autoAlpha: 0.64, xPercent: 10 });
        gsap.set("[data-opening-artifact]", { scale: isCompact ? 0.84 : 0.92, yPercent: isCompact ? -9 : -5 });
        gsap.set("[data-opening-copy-primary], [data-opening-copy-secondary], [data-opening-signature]", {
          autoAlpha: 1,
          y: 0,
        });
        finishOpening();
        return;
      }

      const timeline = gsap.timeline({
        delay: returningVisitor ? 0.03 : 0.09,
        defaults: { force3D: true },
        onUpdate: () => {
          const progress = timeline.progress();
          publishProgress(progress);

          if (progress > 0.34 && soundEnabledRef.current && !clickPlayedRef.current) {
            clickPlayedRef.current = true;
            playMechanicalClick();
          }
        },
        onComplete: finishOpening,
      });

      timelineRef.current = timeline;

      timeline
        .to("[data-opening-car]", {
          autoAlpha: 1,
          scale: 1.06,
          xPercent: 0,
          duration: 0.62,
          ease: "power3.out",
        }, 0)
        .to("[data-car-body-line]", {
          strokeDashoffset: 0,
          duration: 0.38,
          ease: "power2.out",
        }, 0.11)
        .to("[data-opening-reflection]", {
          autoAlpha: 0.64,
          xPercent: 10,
          duration: 0.48,
          ease: "power2.out",
        }, 0.14)
        .to("[data-opening-frame]", {
          autoAlpha: 1,
          duration: 0.3,
          ease: "power2.out",
        }, 0.3)
        .to("[data-frame-line]", {
          strokeDashoffset: 0,
          duration: 0.56,
          ease: "power2.inOut",
        }, 0.34)
        .to("[data-frame-highlight]", {
          strokeDashoffset: 0,
          autoAlpha: 1,
          duration: 0.4,
          ease: "power3.out",
        }, 0.48)
        .to("[data-opening-artifact]", {
          scale: isCompact ? 0.84 : 0.92,
          yPercent: isCompact ? -9 : -5,
          duration: 0.52,
          ease: "power3.inOut",
        }, 0.73)
        .to("[data-opening-copy-primary]", {
          autoAlpha: 1,
          y: 0,
          duration: 0.38,
          ease: "power3.out",
        }, 0.91)
        .to("[data-opening-copy-secondary]", {
          autoAlpha: 1,
          y: 0,
          duration: 0.36,
          ease: "power3.out",
        }, 1.03)
        .to("[data-opening-signature]", {
          autoAlpha: 1,
          y: 0,
          duration: 0.3,
          ease: "power2.out",
        }, 1.18)
        .to("[data-opening-scroll-hint]", {
          autoAlpha: 1,
          duration: 0.28,
          ease: "power2.out",
        }, 1.28);

      if (returningVisitor) timeline.timeScale(1.55);
    }, section);

    function accelerateOpening(amount: number) {
      const timeline = timelineRef.current;
      if (!timeline || introFinishedRef.current) return;

      scrollIntentRef.current += amount;
      if (scrollIntentRef.current >= FAST_SCROLL_THRESHOLD) {
        pendingAdvanceRef.current = true;
      }

      if (accelerationTweenRef.current) return;

      timeline.pause();
      accelerationTweenRef.current = gsap.to(timeline, {
        progress: 1,
        duration: returningVisitor ? 0.26 : isCompact ? 0.38 : 0.48,
        ease: "power3.out",
        overwrite: true,
        onComplete: () => {
          accelerationTweenRef.current = null;
          finishOpening();
        },
      });
    }

    function handleWheel(event: WheelEvent) {
      if (introFinishedRef.current || event.deltaY <= 0) return;

      event.preventDefault();
      accelerateOpening(Math.abs(event.deltaY));
    }

    function handleTouchStart(event: TouchEvent) {
      touchStartYRef.current = event.touches[0]?.clientY ?? null;
    }

    function handleTouchMove(event: TouchEvent) {
      if (introFinishedRef.current || touchStartYRef.current === null) return;

      const currentY = event.touches[0]?.clientY;
      if (currentY === undefined) return;

      const upwardDistance = touchStartYRef.current - currentY;
      if (upwardDistance <= 8) return;

      event.preventDefault();
      accelerateOpening(upwardDistance);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (introFinishedRef.current || window.scrollY > 40) return;
      if (!["ArrowDown", "PageDown", " ", "End"].includes(event.key)) return;

      event.preventDefault();
      pendingAdvanceRef.current = true;
      accelerateOpening(FAST_SCROLL_THRESHOLD);
    }

    section.addEventListener("wheel", handleWheel, { passive: false });
    section.addEventListener("touchstart", handleTouchStart, { passive: true });
    section.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      section.removeEventListener("wheel", handleWheel);
      section.removeEventListener("touchstart", handleTouchStart);
      section.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("keydown", handleKeyDown);
      if (advanceTimer !== undefined) window.clearTimeout(advanceTimer);
      accelerationTweenRef.current?.kill();
      accelerationTweenRef.current = null;
      timelineRef.current = null;
      context.revert();
      document.documentElement.style.removeProperty("--opening-progress");
    };
  }, [returningVisitor, visitorStateReady]);

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
    pendingAdvanceRef.current = true;
    window.sessionStorage.setItem(INTRO_STORAGE_KEY, "true");

    const timeline = timelineRef.current;
    if (timeline) {
      timeline.pause();
      accelerationTweenRef.current?.kill();
      accelerationTweenRef.current = gsap.to(timeline, {
        progress: 1,
        duration: 0.22,
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

    introFinishedRef.current = true;
    if (!revealDispatchedRef.current) {
      revealDispatchedRef.current = true;
      window.dispatchEvent(new CustomEvent("visr:opening-revealed"));
    }
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
          <p>Scroll to continue</p>
        </div>
      </div>
    </section>
  );
}
