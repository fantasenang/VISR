"use client";

import { useEffect, useRef, useState } from "react";

export function FooterTagline() {
  const ref = useRef<HTMLHeadingElement | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setRevealed(true);
        observer.disconnect();
      },
      { threshold: 0.45 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <h2
      ref={ref}
      className="mt-6 max-w-none overflow-hidden text-[clamp(3.4rem,7vw,7.5rem)] font-normal leading-[0.88] tracking-[-0.065em]"
      aria-label="Carry Your Build."
    >
      <span className="block whitespace-nowrap">Carry Your</span>
      <span className="relative block w-fit whitespace-nowrap">
        Build.
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-[-8%] left-[-35%] w-[28%] skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/28 to-transparent blur-[1px] transition-transform duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:hidden ${
            revealed ? "translate-x-[520%]" : "translate-x-0"
          }`}
        />
      </span>
    </h2>
  );
}
