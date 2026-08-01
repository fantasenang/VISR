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
    aura: "rgb(185 31 46 / 18%)",
  },
  {
    slug: "ice",
    name: "Ice Halo",
    line: "Clear Edge",
    description: "A pale, cool edge treatment that gives the visor a restrained luminous outline under direct light.",
    accent: "#d8eff5",
    glow: "rgb(216 239 245 / 62%)",
    aura: "rgb(190 229 239 / 17%)",
  },
  {
    slug: "emerald",
    name: "Emerald Halo",
    line: "Deep Edge",
    description: "A composed green edge treatment that reveals more depth as light travels through the visor material.",
    accent: "#187a55",
    glow: "rgb(24 122 85 / 68%)",
    aura: "rgb(24 122 85 / 18%)",
  },
  {
    slug: "amber",
    name: "Amber Halo",
    line: "Warm Edge",
    description: "A warm amber edge treatment that becomes visually brighter when the visor is struck by light.",
    accent: "#d48722",
    glow: "rgb(212 135 34 / 66%)",
    aura: "rgb(212 135 34 / 18%)",
  },
  {
    slug: "pink",
    name: "Pink Halo",
    line: "Soft Edge",
    description: "A soft pink edge treatment that creates a controlled glowing impression without an internal light source.",
    accent: "#e58cac",
    glow: "rgb(229 140 172 / 65%)",
    aura: "rgb(229 140 172 / 18%)",
  },
] as const;

export function HaloCollection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const stepRefs = useRef<Array<HTMLDivElement | null>>([]);
  const activeHalo = halos[activeIndex];
  const sectionStyle = {
    "--halo-aura": activeHalo.aura,
    "--halo-accent": activeHalo.accent,
    "--halo-glow": activeHalo.glow,
  } as CSSProperties;

  useEffect(() => {
    const steps = stepRefs.current.filter((step): step is HTMLDivElement => Boolean(step));

    if (!steps.length || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const activeEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!activeEntry) {
          return;
        }

        const nextIndex = Number((activeEntry.target as HTMLElement).dataset.haloIndex);
        if (Number.isInteger(nextIndex)) {
          setActiveIndex(nextIndex);
        }
      },
      {
        rootMargin: "-38% 0px -38% 0px",
        threshold: [0, 0.25, 0.5, 0.75],
      },
    );

    steps.forEach((step) => observer.observe(step));
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="halo"
      className={styles.section}
      style={sectionStyle}
      aria-labelledby="halo-collection-title"
    >
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
          <div className={styles.stickyInner}>
            <div className={styles.stage}>
              <div className={styles.media}>
                <img
                  key={activeHalo.slug}
                  src={`/images/halo/halo-${activeHalo.slug}.webp`}
                  alt={`${activeHalo.name} colored-edge visor installed on VISR Carry`}
                  width={447}
                  height={558}
                  loading="lazy"
                  decoding="async"
                  className={styles.image}
                />

                <div key={`${activeHalo.slug}-label`} className={styles.visualLabel} aria-live="polite">
                  <p className={styles.activeIndex}>
                    {String(activeIndex + 1).padStart(2, "0")} / 05
                  </p>
                  <h3 className={styles.name}>{activeHalo.name}</h3>
                  <p className={styles.line}>{activeHalo.line}</p>
                </div>
              </div>

              <div key={`${activeHalo.slug}-detail`} className={styles.detail}>
                <p className={styles.description}>{activeHalo.description}</p>
              </div>
            </div>

            <div className={styles.progress} aria-hidden="true">
              <div className={styles.progressTrack}>
                {halos.map((halo, index) => (
                  <span
                    key={halo.slug}
                    className={styles.progressSegment}
                    data-active={activeIndex === index}
                  />
                ))}
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
