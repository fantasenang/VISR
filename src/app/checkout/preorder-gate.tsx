"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getPreorderPhase, getPreorderTarget } from "@/lib/commerce/preorder";

function formatRemaining(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

export default function PreorderGate({ children, forceOpen = false }: { children: ReactNode; forceOpen?: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  const phase = forceOpen ? "open" : getPreorderPhase(now);
  const remaining = useMemo(() => formatRemaining(getPreorderTarget(phase) - now), [now, phase]);

  useEffect(() => {
    if (forceOpen) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [forceOpen]);

  if (phase === "open") return children;

  return (
    <main className="flex min-h-screen items-center bg-[#050505] px-6 py-16 text-white">
      <div className="mx-auto w-full max-w-3xl rounded-[2rem] border border-white/10 bg-white/[0.025] p-8 md:p-14">
        <p className="visr-label text-white/40">VISR Carry / Batch 2</p>
        <h1 className="mt-5 text-4xl tracking-[-0.045em] md:text-6xl">
          {phase === "upcoming" ? "Preorder has not opened yet." : "Batch 2 preorder is closed."}
        </h1>
        <p className="mt-6 max-w-2xl leading-7 text-white/55">
          {phase === "upcoming"
            ? "Checkout activates automatically on 7 August 2026 at 00.00 WIB. The preorder price is Rp179.000 and the allocation is limited to 100 units."
            : "The preorder closed on 13 August 2026 at 23.59 WIB. Production is now proceeding for confirmed reservations."}
        </p>
        {phase === "upcoming" && <p className="mt-8 font-mono text-sm tracking-[0.12em] text-white/70">OPENS IN {remaining}</p>}
        <a href="/" className="mt-10 inline-flex rounded-full border border-white/15 px-6 py-3 text-sm transition hover:bg-white hover:text-black">Return to VISR</a>
      </div>
    </main>
  );
}
