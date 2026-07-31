"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

const VERIFIED_PRODUCT_IMAGE = "/media/phase-16/visr-c01.jpg";

const halos = [
  { slug: "crimson", name: "Crimson Halo", line: "Bold Presence", description: "A decisive red glow that turns the display into a statement.", rgb: "208 28 48" },
  { slug: "ice", name: "Ice Halo", line: "Pure Focus", description: "A colder atmosphere that removes noise and sharpens the object.", rgb: "126 226 255" },
  { slug: "emerald", name: "Emerald Halo", line: "Quiet Depth", description: "A composed green presence with depth that reveals itself slowly.", rgb: "36 194 132" },
  { slug: "amber", name: "Amber Halo", line: "Warm Precision", description: "A warm architectural light that gives the display a gallery-like calm.", rgb: "235 169 49" },
  { slug: "pink", name: "Pink Halo", line: "Unexpected Elegance", description: "A playful tone held inside a restrained and precise display system.", rgb: "255 78 166" },
] as const;

export function HaloCollection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const rect = section.getBoundingClientRect();
      const scrollable = Math.max(1, section.offsetHeight - window.innerHeight);
      const nextProgress = Math.min(1, Math.max(0, -rect.top / scrollable));
      const sequenceProgress = Math.min(0.999, nextProgress / 0.82);
      setProgress(nextProgress);
      setActiveIndex(Math.min(halos.length - 1, Math.floor(sequenceProgress * halos.length)));
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const active = halos[activeIndex];
  const endingVisible = progress >= 0.84;

  return (
    <section
      ref={sectionRef}
      id="halo"
      className="halo-exhibition"
      aria-labelledby="halo-collection-title"
      style={{ "--active-rgb": active.rgb } as CSSProperties}
    >
      <div className="halo-stage">
        <div className="halo-ambient" aria-hidden="true" />
        <div className="halo-vignette" aria-hidden="true" />

        <header className="halo-header visr-container">
          <div>
            <p className="visr-label">Halo Collection</p>
            <p className="halo-note">Five personalities. One display philosophy.</p>
          </div>
          <p className="halo-counter">0{activeIndex + 1} / 05</p>
        </header>

        <div className="halo-object" data-ending={endingVisible}>
          <div className="halo-object__glow" aria-hidden="true" />
          <img src={VERIFIED_PRODUCT_IMAGE} alt={`${active.name} VISR Carry display`} />
          <div className="halo-object__wash" aria-hidden="true" />
        </div>

        <div className="halo-copy visr-container" data-ending={endingVisible}>
          {halos.map((halo, index) => (
            <article key={halo.slug} data-active={index === activeIndex}>
              <p>{halo.name}</p>
              <h2 id={index === 0 ? "halo-collection-title" : undefined}>{halo.line}</h2>
              <span>{halo.description}</span>
            </article>
          ))}
        </div>

        <div className="halo-rail" aria-hidden="true">
          {halos.map((halo, index) => (
            <span key={halo.slug} data-active={index === activeIndex} style={{ "--halo-rgb": halo.rgb } as CSSProperties} />
          ))}
        </div>

        <div className="halo-finale visr-container" data-visible={endingVisible}>
          <div>
            <p className="visr-label">The complete collection</p>
            <h3>Choose your Halo.</h3>
            <p>Five distinct atmospheres. One display system.</p>
            <a href="/checkout">Reserve your Halo</a>
          </div>
          <div className="halo-lineup" aria-label="Five Halo colour identities">
            {halos.map((halo) => (
              <figure key={halo.slug} style={{ "--halo-rgb": halo.rgb } as CSSProperties}>
                <div><img src={VERIFIED_PRODUCT_IMAGE} alt="" /></div>
                <figcaption>{halo.name.replace(" Halo", "")}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>

      <div className="halo-scroll-map" aria-hidden="true">
        {halos.map((halo) => <div key={halo.slug} />)}
        <div />
      </div>

      <style jsx>{`
        .halo-exhibition { position:relative; height:720svh; border-top:1px solid rgb(255 255 255/.07); background:#020202; color:#f7f7f5; }
        .halo-stage { position:sticky; top:0; height:100svh; min-height:640px; overflow:hidden; isolation:isolate; background:#020202; }
        .halo-ambient { position:absolute; z-index:-2; inset:-20%; background:radial-gradient(circle at 50% 47%,rgb(var(--active-rgb)/.26),transparent 27%),radial-gradient(ellipse at 50% 60%,rgb(var(--active-rgb)/.09),transparent 52%); filter:blur(32px); transition:background 900ms ease; }
        .halo-vignette { position:absolute; z-index:5; inset:0; pointer-events:none; background:linear-gradient(180deg,rgb(0 0 0/.65),transparent 27%,transparent 67%,rgb(0 0 0/.88)),radial-gradient(circle at center,transparent 32%,rgb(0 0 0/.58)); }
        .halo-header { position:absolute; z-index:12; top:clamp(5rem,8svh,7.5rem); right:0; left:0; display:flex; justify-content:space-between; gap:2rem; }
        .halo-header p { margin:0; }
        .halo-header .visr-label { color:rgb(247 247 245/.48); }
        .halo-note { margin-top:.8rem!important; color:rgb(247 247 245/.3); font-size:.72rem; }
        .halo-counter { color:rgb(247 247 245/.62); font-size:.68rem; letter-spacing:.18em; }
        .halo-object { position:absolute; z-index:1; top:50%; left:50%; width:min(72vw,920px); height:min(65svh,720px); transform:translate(-50%,-48%); transition:opacity 650ms ease,transform 900ms ease; }
        .halo-object[data-ending="true"] { opacity:0; transform:translate(-50%,-48%) scale(.92); }
        .halo-object img { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; filter:brightness(.92) contrast(1.06) saturate(.78); }
        .halo-object__glow { position:absolute; inset:18% 8% 7%; border-radius:50%; background:radial-gradient(ellipse,rgb(var(--active-rgb)/.48),transparent 66%); filter:blur(38px); transition:background 850ms ease; }
        .halo-object__wash { position:absolute; inset:5% 4%; background:linear-gradient(135deg,transparent 28%,rgb(var(--active-rgb)/.18) 55%,transparent 78%); mix-blend-mode:screen; mask-image:radial-gradient(ellipse at center,#000 22%,transparent 72%); transition:background 850ms ease; }
        .halo-copy { position:absolute; z-index:10; right:0; bottom:clamp(4rem,8svh,7rem); left:0; transition:opacity 500ms ease,transform 700ms ease; }
        .halo-copy[data-ending="true"] { opacity:0; transform:translateY(20px); }
        .halo-copy article { position:absolute; bottom:0; left:0; width:min(35rem,calc(100vw - 3rem)); opacity:0; transform:translateY(22px); transition:opacity 550ms ease,transform 800ms cubic-bezier(.22,1,.36,1); }
        .halo-copy article[data-active="true"] { opacity:1; transform:none; }
        .halo-copy article p { margin:0 0 .8rem; color:rgb(var(--active-rgb)/.92); font-size:.68rem; letter-spacing:.18em; text-transform:uppercase; }
        .halo-copy h2 { max-width:8ch; margin:0; font-size:clamp(3.2rem,8vw,7rem); font-weight:400; line-height:.9; letter-spacing:-.065em; }
        .halo-copy span { display:block; max-width:29rem; margin-top:1.25rem; color:rgb(247 247 245/.48); font-size:.92rem; line-height:1.7; }
        .halo-rail { position:absolute; z-index:12; top:50%; right:max(1.5rem,calc((100vw - 1480px)/2)); display:flex; height:7rem; align-items:flex-end; gap:.4rem; transform:translateY(-50%); }
        .halo-rail span { width:2px; height:42%; background:rgb(247 247 245/.16); transition:height 550ms ease,background 500ms ease; }
        .halo-rail span[data-active="true"] { height:100%; background:rgb(var(--halo-rgb)/.95); }
        .halo-finale { position:absolute; z-index:15; inset:0; display:grid; align-content:center; gap:3rem; opacity:0; transform:translateY(30px); pointer-events:none; transition:opacity 850ms ease,transform 1s ease; }
        .halo-finale[data-visible="true"] { opacity:1; transform:none; pointer-events:auto; }
        .halo-finale h3 { margin:0; font-size:clamp(3.5rem,9vw,8rem); font-weight:400; line-height:.9; letter-spacing:-.07em; }
        .halo-finale > div > p:last-of-type { color:rgb(247 247 245/.48); }
        .halo-finale a { display:inline-flex; margin-top:1.4rem; border:1px solid rgb(247 247 245/.2); border-radius:999px; padding:.9rem 1.25rem; color:inherit; font-size:.78rem; text-decoration:none; }
        .halo-lineup { display:grid; grid-template-columns:repeat(5,1fr); gap:.65rem; }
        .halo-lineup figure { margin:0; min-width:0; }
        .halo-lineup figure div { position:relative; overflow:hidden; aspect-ratio:4/5; border:1px solid rgb(var(--halo-rgb)/.28); background:radial-gradient(circle,rgb(var(--halo-rgb)/.22),#050505 68%); }
        .halo-lineup img { width:100%; height:100%; object-fit:cover; opacity:.82; filter:saturate(.5); mix-blend-mode:screen; }
        .halo-lineup figcaption { margin-top:.55rem; color:rgb(var(--halo-rgb)/.9); font-size:.6rem; letter-spacing:.12em; text-transform:uppercase; }
        .halo-scroll-map { position:absolute; inset:0; display:grid; grid-template-rows:repeat(6,1fr); pointer-events:none; }
        @media (max-width:767px) { .halo-object { width:108vw; height:58svh; } .halo-copy h2 { font-size:clamp(3.1rem,15vw,5.4rem); } .halo-copy span { max-width:78vw; font-size:.8rem; } .halo-rail { display:none; } .halo-finale { align-content:center; } .halo-lineup { grid-template-columns:repeat(5,minmax(70px,1fr)); overflow-x:auto; padding-bottom:.5rem; } .halo-lineup figure div { width:88px; } }
        @media (prefers-reduced-motion:reduce) { .halo-object,.halo-copy article,.halo-finale { transition:none; } }
      `}</style>
    </section>
  );
}
