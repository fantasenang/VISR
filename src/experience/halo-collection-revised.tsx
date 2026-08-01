"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import styles from "./halo-collection.module.css";

const halos = [
  {
    slug: "crimson",
    name: "Crimson Halo",
    line: "Bold Edge",
    description: "A deep red edge treatment that becomes more pronounced when external light enters the visor.",
    accent: "#b91f2e",
    glow: "rgb(220 38 56 / 62%)",
    aura: "rgb(185 31 46 / 28%)",
  },
  {
    slug: "ice",
    name: "Ice Halo",
    line: "Clear Edge",
    description: "A pale, cool edge treatment that gives the visor a restrained luminous outline under direct light.",
    accent: "#d8eff5",
    glow: "rgb(216 239 245 / 62%)",
    aura: "rgb(190 229 239 / 24%)",
  },
  {
    slug: "emerald",
    name: "Emerald Halo",
    line: "Deep Edge",
    description: "A composed green edge treatment that reveals more depth as light travels through the visor material.",
    accent: "#187a55",
    glow: "rgb(24 122 85 / 68%)",
    aura: "rgb(24 122 85 / 27%)",
  },
  {
    slug: "amber",
    name: "Amber Halo",
    line: "Warm Edge",
    description: "A warm amber edge treatment that becomes visually brighter when the visor is struck by light.",
    accent: "#d48722",
    glow: "rgb(212 135 34 / 66%)",
    aura: "rgb(212 135 34 / 27%)",
  },
  {
    slug: "pink",
    name: "Pink Halo",
    line: "Soft Edge",
    description: "A soft pink edge treatment that creates a controlled glowing impression without an internal light source.",
    accent: "#e58cac",
    glow: "rgb(229 140 172 / 65%)",
    aura: "rgb(229 140 172 / 27%)",
  },
] as const;

export function HaloCollection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const stepRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const steps = stepRefs.current.filter((step): step is HTMLDivElement => Boolean(step));

    if (!steps.length || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const activeEntry = entries.find((entry) => entry.isIntersecting);

        if (!activeEntry) {
          return;
        }

        const nextIndex = Number((activeEntry.target as HTMLElement).dataset.haloIndex);
        if (Number.isInteger(nextIndex)) {
          setActiveIndex((currentIndex) => (currentIndex === nextIndex ? currentIndex : nextIndex));
        }
      },
      {
        rootMargin: "-48% 0px -48% 0px",
        threshold: 0,
      },
    );

    steps.forEach((step) => observer.observe(step));
    return () => observer.disconnect();
  }, []);

  return (
    <section id="halo" className={styles.section} aria-labelledby="halo-collection-title">
      <div className={styles.introduction}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Halo Collection</p>
          <p className={styles.counter}>H01—H05</p>
        </header>

        <h2 id="halo-collection-title" className={styles.title}>
          Introducing Halo Collection.
        </h2>
        <p className={styles.intro}>
          A colored-edge visor designed to catch surrounding light and trace the silhouette of VISR Carry with a distinct luminous character. Five edge colors, each changing the presence of the display.
        </p>
      </div>

      <div className={styles.story}>
        <div className={styles.sticky}>
          <div className={styles.canvas}>
            {halos.map((halo, index) => {
              const auraStyle = { "--halo-aura": halo.aura } as CSSProperties;

              return (
                <span
                  key={`${halo.slug}-aura`}
                  className={styles.auraLayer}
                  style={auraStyle}
                  data-active={activeIndex === index}
                  aria-hidden="true"
                />
              );
            })}

            <div className={styles.imageStack}>
              {halos.map((halo, index) => (
                <img
                  key={halo.slug}
                  src={`/images/halo/halo-${halo.slug}.webp`}
                  alt={activeIndex === index ? `${halo.name} colored-edge visor installed on VISR Carry` : ""}
                  width={447}
                  height={558}
                  loading="lazy"
                  decoding="async"
                  className={styles.imageLayer}
                  data-active={activeIndex === index}
                  aria-hidden={activeIndex !== index}
                />
              ))}
            </div>

            <div className={styles.imageTreatment} aria-hidden="true" />

            <div className={styles.topline} aria-hidden="true">
              <span>Halo Collection</span>
              <span>{String(activeIndex + 1).padStart(2, "0")} / 05</span>
            </div>

            <div className={styles.copyStack} aria-live="polite">
              {halos.map((halo, index) => (
                <div
                  key={`${halo.slug}-copy`}
                  className={styles.copyLayer}
                  data-active={activeIndex === index}
                  aria-hidden={activeIndex !== index}
                >
                  <p className={styles.activeIndex}>{String(index + 1).padStart(2, "0")} / 05</p>
                  <h3 className={styles.name}>{halo.name}</h3>
                  <p className={styles.line}>{halo.line}</p>
                  <p className={styles.description}>{halo.description}</p>
                </div>
              ))}
            </div>

            <div className={styles.progress} aria-hidden="true">
              <div className={styles.progressTrack}>
                {halos.map((halo, index) => {
                  const progressStyle = {
                    "--halo-accent": halo.accent,
                    "--halo-glow": halo.glow,
                  } as CSSProperties;

                  return (
                    <span
                      key={`${halo.slug}-progress`}
                      className={styles.progressSegment}
                      style={progressStyle}
                      data-active={activeIndex === index}
                    />
                  );
                })}
              </div>
              <p>Scroll to shift the edge</p>
            </div>
          </div>
        </div>

        <div className={styles.steps} aria-hidden="true">
          {halos.map((halo, index) => (
            <div
              key={halo.slug}
              ref={(node) => {
                stepRefs.current[index] = node;
              }}
              className={styles.step}
              data-halo-index={index}
            />
          ))}
        </div>
      </div>

      <footer className={styles.footer}>
        <p className={styles.availability}>
          Five edge colors. Designed for VISR Carry and shaped by the light around it.
        </p>
        <span className={styles.cta} aria-label="Halo Collection coming soon">
          Coming Soon
        </span>
      </footer>
    </section>
  );
}
