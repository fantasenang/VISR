"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { C01 } from "./c01";
import { C02 } from "./c02";
import { C03 } from "./c03";
import { C04 } from "./c04";
import { C05 } from "./c05";
import styles from "./carry-phase-16.module.css";

const FRAME_COUNT = 5;

export function CarryPhase16() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const section = sectionRef.current;
    if (!section) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const frameElements = gsap.utils.toArray<HTMLElement>("[data-carry16-frame]", section);
    const copyElements = gsap.utils.toArray<HTMLElement>("[data-carry16-copy]", section);
    const markerElements = gsap.utils.toArray<HTMLElement>("[data-carry16-marker]", section);
    const counter = section.querySelector<HTMLElement>("[data-carry16-counter]");

    if (frameElements.length !== FRAME_COUNT || copyElements.length !== FRAME_COUNT) return;

    const context = gsap.context(() => {
      gsap.set(frameElements, {
        autoAlpha: 0,
        scale: 1.04,
        transformOrigin: "50% 50%",
      });
      gsap.set(copyElements, { autoAlpha: 0, y: 22 });
      gsap.set(markerElements, {
        opacity: 0.2,
        scaleY: 0.48,
        transformOrigin: "50% 100%",
      });

      gsap.set(frameElements[0], { autoAlpha: 1, scale: 1.018 });
      gsap.set(copyElements[0], { autoAlpha: 1, y: 0 });
      gsap.set(markerElements[0], { opacity: 1, scaleY: 1 });

      const timeline = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.78,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            if (!counter) return;
            const activeIndex = Math.min(FRAME_COUNT - 1, Math.floor(self.progress * FRAME_COUNT));
            counter.textContent = `C${String(activeIndex + 1).padStart(2, "0")} / C05`;
          },
        },
      });

      timeline.to(frameElements[0], { scale: 1, duration: 0.58, ease: "power2.out" }, 0);

      frameElements.forEach((_, index) => {
        if (index === 0) return;

        const transitionAt = index;
        const previousIndex = index - 1;

        timeline
          .to(copyElements[previousIndex], {
            autoAlpha: 0,
            y: -14,
            duration: 0.17,
            ease: "power2.in",
          }, transitionAt - 0.18)
          .to(frameElements[previousIndex], {
            autoAlpha: 0,
            scale: 0.985,
            duration: 0.3,
            ease: "power2.inOut",
          }, transitionAt - 0.1)
          .to(markerElements[previousIndex], {
            opacity: 0.2,
            scaleY: 0.48,
            duration: 0.15,
          }, transitionAt - 0.06)
          .fromTo(frameElements[index], {
            autoAlpha: 0,
            scale: 1.04,
          }, {
            autoAlpha: 1,
            scale: 1,
            duration: 0.46,
            ease: "power2.inOut",
          }, transitionAt - 0.06)
          .fromTo(copyElements[index], {
            autoAlpha: 0,
            y: 22,
          }, {
            autoAlpha: 1,
            y: 0,
            duration: 0.32,
            ease: "power2.out",
          }, transitionAt + 0.13)
          .to(markerElements[index], {
            opacity: 1,
            scaleY: 1,
            duration: 0.18,
          }, transitionAt + 0.09);
      });

      timeline.to(frameElements[FRAME_COUNT - 1], {
        scale: 0.992,
        duration: 0.75,
        ease: "power2.out",
      }, FRAME_COUNT - 0.36);
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
      id="carry"
      className={styles.section}
      aria-labelledby="carry-phase-16-title"
    >
      <div className={styles.stage}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>VISR Carry / The Portable Exhibition</p>
          <p className={styles.counter} data-carry16-counter>C01 / C05</p>
        </header>

        <h2 id="carry-phase-16-title" className={styles.srOnly}>
          VISR Carry portable display experience
        </h2>

        <div className={styles.frames}>
          <C01 />
          <C02 />
          <C03 />
          <C04 />
          <C05 />
        </div>

        <div className={styles.progress} aria-hidden="true">
          {Array.from({ length: FRAME_COUNT }, (_, index) => (
            <span key={index} data-carry16-marker />
          ))}
        </div>

        <p className={styles.signature} aria-hidden="true">Designed to carry. Built to display.</p>
      </div>
    </section>
  );
}
