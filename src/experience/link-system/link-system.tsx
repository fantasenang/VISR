"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import styles from "./link-system.module.css";

const frames = [
  {
    number: "01",
    src: "/media/phase-15/visr-e01.jpg",
    alt: "VISR Link displayed alone on a black surface",
    title: "The connection starts here.",
    detail: "VISR Link is the magnetic interface at the center of the system.",
    imageClass: styles.e01,
    copyClass: styles.copyTop,
  },
  {
    number: "02",
    src: "/media/phase-15/visr-e02.jpg",
    alt: "A diecast car approaching VISR Link before the magnetic connection",
    title: "Snap into place.",
    detail: "A precise magnetic connection brings the diecast into position.",
    imageClass: styles.e02,
    copyClass: styles.copyTop,
  },
  {
    number: "03",
    src: "/media/phase-15/visr-e03.jpg",
    alt: "A complete diecast car held in the locked position by VISR Link",
    title: "Held precisely. Displayed effortlessly.",
    detail: "The car stays visually elevated while the Link remains discreet.",
    imageClass: styles.e03,
    copyClass: styles.copyTop,
  },
  {
    number: "04",
    src: "/media/phase-15/visr-e04.jpg",
    alt: "VISR Carry base shown beside a detached VISR Link",
    title: "One link. Beyond one display.",
    detail: "Detach it from VISR Carry. The interface remains reusable.",
    imageClass: styles.e04,
    copyClass: styles.copyUpperRight,
  },
  {
    number: "05",
    src: "/media/phase-15/visr-e05.jpg",
    alt: "VISR Link centered alone as the foundation of the display system",
    title: "One link. More ways to display.",
    detail: "Built as the foundation for what comes next.",
    imageClass: styles.e05,
    copyClass: styles.copyBottom,
  },
] as const;

export function LinkSystem() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const section = sectionRef.current;
    if (!section) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const frameElements = gsap.utils.toArray<HTMLElement>("[data-link-frame]", section);
    const copyElements = gsap.utils.toArray<HTMLElement>("[data-link-copy]", section);
    const markerElements = gsap.utils.toArray<HTMLElement>("[data-link-marker]", section);

    const context = gsap.context(() => {
      gsap.set(frameElements, {
        autoAlpha: 0,
        scale: 1.035,
        transformOrigin: "50% 50%",
      });
      gsap.set(copyElements, { autoAlpha: 0, y: 18 });
      gsap.set(markerElements, { opacity: 0.24, scaleY: 0.55, transformOrigin: "50% 100%" });

      gsap.set(frameElements[0], { autoAlpha: 1, scale: 1.018 });
      gsap.set(copyElements[0], { autoAlpha: 1, y: 0 });
      gsap.set(markerElements[0], { opacity: 1, scaleY: 1 });

      const timeline = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.72,
          invalidateOnRefresh: true,
        },
      });

      timeline.to(frameElements[0], { scale: 1, duration: 0.55, ease: "power2.out" }, 0);

      frames.forEach((_, index) => {
        if (index === 0) return;

        const transitionAt = index;
        const previousIndex = index - 1;

        timeline
          .to(copyElements[previousIndex], {
            autoAlpha: 0,
            y: -12,
            duration: 0.16,
            ease: "power2.in",
          }, transitionAt - 0.16)
          .to(frameElements[previousIndex], {
            autoAlpha: 0,
            scale: 0.985,
            duration: 0.28,
            ease: "power2.inOut",
          }, transitionAt - 0.08)
          .to(markerElements[previousIndex], {
            opacity: 0.24,
            scaleY: 0.55,
            duration: 0.14,
          }, transitionAt - 0.04)
          .fromTo(frameElements[index], {
            autoAlpha: 0,
            scale: 1.035,
          }, {
            autoAlpha: 1,
            scale: 1,
            duration: 0.42,
            ease: "power2.inOut",
          }, transitionAt - 0.05)
          .fromTo(copyElements[index], {
            autoAlpha: 0,
            y: 18,
          }, {
            autoAlpha: 1,
            y: 0,
            duration: 0.3,
            ease: "power2.out",
          }, transitionAt + 0.12)
          .to(markerElements[index], {
            opacity: 1,
            scaleY: 1,
            duration: 0.18,
          }, transitionAt + 0.08);
      });

      timeline.to(frameElements[frames.length - 1], {
        scale: 0.992,
        duration: 0.72,
        ease: "power2.out",
      }, frames.length - 0.35);
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
      id="link-system"
      className={styles.section}
      aria-labelledby="link-system-title"
    >
      <div className={styles.stage}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>VISR / The System</p>
          <p className={styles.counter}>E01—E05</p>
        </header>

        <h2 id="link-system-title" className={styles.srOnly}>
          VISR Link magnetic display system
        </h2>

        <div className={styles.frames}>
          {frames.map((frame, index) => (
            <article
              key={frame.number}
              className={`${styles.frame} ${frame.imageClass}`}
              data-link-frame
              aria-label={`${frame.number}. ${frame.title}`}
            >
              <Image
                className={styles.image}
                src={frame.src}
                alt={frame.alt}
                fill
                priority={index === 0}
                sizes="(max-width: 767px) 100vw, 430px"
                draggable={false}
              />

              <div className={styles.imageTreatment} aria-hidden="true" />

              <div className={`${styles.copy} ${frame.copyClass}`} data-link-copy>
                <p className={styles.frameNumber}>{frame.number} / 05</p>
                <h3>{frame.title}</h3>
                <p className={styles.detail}>{frame.detail}</p>
              </div>
            </article>
          ))}
        </div>

        <div className={styles.progress} aria-hidden="true">
          {frames.map((frame) => (
            <span key={frame.number} data-link-marker />
          ))}
        </div>
      </div>
    </section>
  );
}
