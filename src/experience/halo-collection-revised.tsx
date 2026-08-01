"use client";

import { useState, type CSSProperties } from "react";
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
  const activeHalo = halos[activeIndex];
  const sectionStyle = { "--halo-aura": activeHalo.aura } as CSSProperties;

  return (
    <section
      id="halo"
      className={styles.section}
      style={sectionStyle}
      aria-labelledby="halo-collection-title"
    >
      <div className={styles.inner}>
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

            <div className={styles.visualLabel} aria-live="polite">
              <p className={styles.activeIndex}>
                {String(activeIndex + 1).padStart(2, "0")} / 05
              </p>
              <h3 className={styles.name}>{activeHalo.name}</h3>
              <p className={styles.line}>{activeHalo.line}</p>
            </div>
          </div>

          <div className={styles.detail}>
            <p className={styles.description}>{activeHalo.description}</p>
          </div>
        </div>

        <div className={styles.selector} role="group" aria-label="Choose a Halo edge color">
          {halos.map((halo, index) => {
            const selectorStyle = {
              "--halo-accent": halo.accent,
              "--halo-glow": halo.glow,
            } as CSSProperties;

            return (
              <button
                key={halo.slug}
                type="button"
                className={styles.selectorButton}
                style={selectorStyle}
                aria-label={`Show ${halo.name}`}
                aria-pressed={activeIndex === index}
                onClick={() => setActiveIndex(index)}
              >
                <span className={styles.selectorVisual} aria-hidden="true">
                  <span className={styles.selectorSwatch} />
                </span>
                <span className={styles.selectorIndex}>{String(index + 1).padStart(2, "0")}</span>
              </button>
            );
          })}
        </div>

        <footer className={styles.footer}>
          <p className={styles.availability}>
            Five edge colors. Designed for VISR Carry and shaped by the light around it.
          </p>
          <span className={styles.cta} aria-label="Halo Collection coming soon">
            Coming Soon
          </span>
        </footer>
      </div>
    </section>
  );
}
