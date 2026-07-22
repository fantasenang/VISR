"use client";

import { useEffect, useState } from "react";

export function OpeningSequence() {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setRevealed(true), 650);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <section id="opening" className="relative flex min-h-[100svh] items-center overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className={`absolute left-1/2 top-1/2 h-[22rem] w-[68rem] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-white/[0.06] transition-all duration-[1800ms] [transition-timing-function:var(--ease-product)] ${revealed ? "scale-100 opacity-100" : "scale-[0.82] opacity-0"}`} />
        <div className={`absolute left-1/2 top-1/2 h-px w-[78vw] -translate-x-1/2 bg-gradient-to-r from-transparent via-white/60 to-transparent transition-all delay-300 duration-[1600ms] ${revealed ? "opacity-70 blur-0" : "opacity-0 blur-sm"}`} />
        <div className={`absolute left-[56%] top-[48%] h-24 w-40 -translate-x-1/2 -translate-y-1/2 rounded-[44%_56%_35%_45%] bg-white/[0.035] shadow-[0_0_100px_rgba(255,255,255,0.08)] transition-all delay-500 duration-[1800ms] ${revealed ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`} />
      </div>

      <div className="visr-container relative z-10 flex min-h-[100svh] flex-col justify-end pb-16 pt-28 md:pb-20">
        <p className={`visr-label mb-5 text-white/40 transition-all delay-700 duration-1000 ${revealed ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`}>Digital Exhibition / Foundation Preview</p>
        <h1 className={`visr-display transition-all delay-[850ms] duration-[1400ms] [transition-timing-function:var(--ease-product)] ${revealed ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}>
          Designed to disappear.
        </h1>
        <p className={`mt-3 text-[clamp(2rem,5vw,5.75rem)] font-normal leading-[0.98] tracking-[-0.05em] text-white/48 transition-all delay-[1100ms] duration-[1400ms] ${revealed ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}>
          Engineered to elevate.
        </p>
        <div className={`mt-10 flex items-center gap-4 transition-all delay-[1350ms] duration-1000 ${revealed ? "opacity-100" : "opacity-0"}`}>
          <span className="h-px w-12 bg-white/30" aria-hidden="true" />
          <span className="visr-label text-white/45">Scroll to reveal</span>
        </div>
      </div>
    </section>
  );
}
