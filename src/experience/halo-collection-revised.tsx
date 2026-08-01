"use client";

import { useState, type CSSProperties } from "react";
import styles from "./halo-collection.module.css";

const halos = [
  {
    slug: "crimson",
    name: "Crimson Halo",
    line: "Bold Presence",
    description: "A decisive red atmosphere that turns the display into a statement without taking attention away from the build.",
    accent: "#b91f2e",
    glow: "rgb(220 38 56 / 62%)",
    aura: "rgb(185 31 46 / 18%)",
  },
  {
    slug: "ice",
    name: "Ice Halo",
    line: "Pure Focus",
    description: "A colder, cleaner light that removes visual noise and sharpens every line of the collection.",
    accent: "#d8eff5",
    glow: "rgb(216 239 245 / 62%)",
    aura: "rgb(190 229 239 / 17%)",
  },
  {
    slug: "emerald",
    name: "Emerald Halo",
    line: "Quiet Depth",
    description: "A composed green atmosphere with depth that reveals itself slowly around darker builds.",
    accent: "#187a55",
    glow: "rgb(24 122 85 / 68%)",
    aura: "rgb(24 122 85 / 18%)",
  },
  {
    slug: "amber",
    name: "Amber Halo",
    line: "Warm Precision",
    description: "A warm architectural light that gives the display the restrained calm of a private gallery.",
    accent: "#d48722",
    glow: "rgb(212 135 34 / 66%)",
    aura: "rgb(212 135 34 / 18%)",
  },
  {
    slug: "pink",
    name: "Pink Halo",
    line: "Unexpected Elegance",
    description: "A playful light held inside a precise display system—unexpected, controlled, and unmistakably personal.",
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
          A light for every build.
        </h2>
        <p className={styles.intro}>
          Halo changes the atmosphere around the collection. Select a character and let the display take on a different presence.
        </p>

        <div className={styles.stage}>
          <div className={styles.media}>
            <img
              key={activeHalo.slug}
              src={`/images/halo/halo-${activeHalo.slug}.webp`}
              alt={`${activeHalo.name} installed on VISR Carry`}
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

        <div className={styles.selector} role="group" aria-label="Choose a Halo color">
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
            Available separately. Designed to lock directly into VISR Carry through the VISR Link system.
          </p>
          <a href="/checkout" className={styles.cta}>
            Reserve your Halo
          </a>
        </footer>
      </div>
    </section>
  );
}
