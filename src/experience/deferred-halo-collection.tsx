"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const HaloCollection = dynamic(
  () => import("@/experience/halo-collection-revised").then((module) => module.HaloCollection),
  { ssr: false },
);

export function DeferredHaloCollection() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const load = () => setShouldLoad(true);
    const haloLink = document.querySelector<HTMLAnchorElement>('a[href="#halo-entry"]');

    haloLink?.addEventListener("click", load, { passive: true });

    if (window.matchMedia("(min-width: 768px)").matches || !("IntersectionObserver" in window)) {
      load();

      return () => {
        haloLink?.removeEventListener("click", load);
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        load();
        observer.disconnect();
      },
      { rootMargin: "1800px 0px" },
    );

    observer.observe(host);

    return () => {
      observer.disconnect();
      haloLink?.removeEventListener("click", load);
    };
  }, []);

  return (
    <div
      ref={hostRef}
      id="halo-entry"
      className="min-h-[720svh] bg-[#020202]"
      aria-busy={!shouldLoad}
    >
      {shouldLoad ? <HaloCollection /> : null}
    </div>
  );
}
