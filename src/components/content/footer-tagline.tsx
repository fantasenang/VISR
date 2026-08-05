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
      className="mt-6 max-w-none overflow-hidden text-[clamp(2.35rem,10vw,7.5rem)] font-normal leading-[0.92] tracking-[-0.065em]"
      aria-label="Carry Your Build."
    >
      <span className="relative block w-fit whitespace-nowrap">
        Carry Your Build.
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-[-8%] left-[-30%] w-[22%] skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/28 to-transparent blur-[1px] transition-transform duration-[1400ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:hidden ${
            revealed ? "translate-x-[650%]" : "translate-x-0"
          }`}
        />
      </span>
    </h2>
  );
}
