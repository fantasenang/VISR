"use client";

import { useEffect, useMemo, useState } from "react";
import { getPreorderPhase, getPreorderTarget, type PreorderPhase } from "@/lib/commerce/preorder";

function formatRemaining(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

export function PreorderCta({ forceOpen = false }: { forceOpen?: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  const phase: PreorderPhase = forceOpen ? "open" : getPreorderPhase(now);
  const target = getPreorderTarget(phase);
  const remaining = useMemo(() => formatRemaining(target - now), [now, target]);

  useEffect(() => {
    if (forceOpen) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [forceOpen]);

  if (phase === "open") {
    return (
      <>
        <a href="/checkout" className="mt-10 inline-flex items-center justify-center rounded-full bg-white px-8 py-4 text-sm font-medium transition hover:bg-white/85" style={{ color: "#030303" }}>
          Reserve Your VISR
        </a>
        <p className="mx-auto mt-5 max-w-lg text-xs leading-5 text-white/32">Preorder closes 13 August 2026 at 23.59 WIB, or earlier when 100 units are reserved.</p>
        {!forceOpen && <p className="mt-3 font-mono text-xs tracking-[0.12em] text-white/55">CLOSES IN {remaining}</p>}
      </>
    );
  }

  if (phase === "upcoming") {
    return (
      <>
        <span className="mt-10 inline-flex cursor-not-allowed items-center justify-center rounded-full border border-white/15 px-8 py-4 text-sm text-white/55">Preorder Opens 7 August</span>
        <p className="mx-auto mt-5 max-w-lg text-xs leading-5 text-white/32">Batch 2 opens 7 August 2026 at 00.00 WIB. Checkout will activate automatically.</p>
        <p className="mt-3 font-mono text-xs tracking-[0.12em] text-white/55">OPENS IN {remaining}</p>
      </>
    );
  }

  return (
    <>
      <span className="mt-10 inline-flex cursor-not-allowed items-center justify-center rounded-full border border-white/15 px-8 py-4 text-sm text-white/40">Preorder Closed</span>
      <p className="mx-auto mt-5 max-w-lg text-xs leading-5 text-white/32">Batch 2 preorder closed on 13 August 2026 at 23.59 WIB. Production is now in progress.</p>
    </>
  );
}
