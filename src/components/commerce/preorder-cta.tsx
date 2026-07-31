"use client";

import { useEffect, useMemo, useState } from "react";
import { getPreorderPhase, getPreorderTarget, type PreorderPhase } from "@/lib/commerce/preorder";

type StockSnapshot = {
  total: number;
  reserved: number;
  sold: number;
  remaining: number;
  soldOut: boolean;
};

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
  const [stock, setStock] = useState<StockSnapshot | null>(null);
  const phase: PreorderPhase = forceOpen ? "open" : getPreorderPhase(now);
  const target = getPreorderTarget(phase);
  const remainingTime = useMemo(() => formatRemaining(target - now), [now, target]);

  useEffect(() => {
    if (forceOpen) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [forceOpen]);

  useEffect(() => {
    let active = true;

    async function refreshStock() {
      try {
        const response = await fetch("/api/stock/carry", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as StockSnapshot;
        if (active) setStock(payload);
      } catch {}
    }

    void refreshStock();
    const timer = window.setInterval(refreshStock, 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const soldOut = stock?.soldOut === true;
  const percentageRemaining = stock && stock.total > 0 ? Math.max(0, Math.min(100, (stock.remaining / stock.total) * 100)) : 100;

  const stockIndicator = stock ? (
    <div className="mx-auto mt-8 max-w-md" aria-live="polite">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-white/45">
        <span>{soldOut ? "Batch Fully Reserved" : `${stock.remaining} Units Remaining`}</span>
        <span>{stock.total} Total</span>
      </div>
      <div className="mt-3 h-px overflow-hidden bg-white/12">
        <div className="h-full bg-white transition-[width] duration-700" style={{ width: `${percentageRemaining}%` }} />
      </div>
      <p className="mt-3 text-xs leading-5 text-white/30">Live availability includes paid units and active checkout reservations.</p>
    </div>
  ) : null;

  if (phase === "open") {
    if (soldOut) {
      return (
        <>
          {stockIndicator}
          <a href="https://wa.me/6281806288892" className="mt-10 inline-flex items-center justify-center rounded-full border border-white/20 px-8 py-4 text-sm text-white/75 transition hover:border-white/40 hover:text-white">Join Waiting List</a>
          <p className="mx-auto mt-5 max-w-lg text-xs leading-5 text-white/32">Batch 2 has reached its 100-unit allocation.</p>
        </>
      );
    }

    return (
      <>
        {stockIndicator}
        <a href="/checkout" className="mt-10 inline-flex items-center justify-center rounded-full bg-white px-8 py-4 text-sm font-medium transition hover:bg-white/85" style={{ color: "#030303" }}>Reserve Your VISR</a>
        <p className="mx-auto mt-5 max-w-lg text-xs leading-5 text-white/32">Preorder closes 13 August 2026 at 23.59 WIB, or earlier when all 100 units are reserved.</p>
        {!forceOpen && <p className="mt-3 font-mono text-xs tracking-[0.12em] text-white/55">CLOSES IN {remainingTime}</p>}
      </>
    );
  }

  if (phase === "upcoming") {
    return (
      <>
        {stockIndicator}
        <span className="mt-10 inline-flex cursor-not-allowed items-center justify-center rounded-full border border-white/15 px-8 py-4 text-sm text-white/55">Preorder Opens 7 August</span>
        <p className="mx-auto mt-5 max-w-lg text-xs leading-5 text-white/32">Batch 2 opens 7 August 2026 at 00.00 WIB. Checkout will activate automatically.</p>
        <p className="mt-3 font-mono text-xs tracking-[0.12em] text-white/55">OPENS IN {remainingTime}</p>
      </>
    );
  }

  return (
    <>
      {stockIndicator}
      <span className="mt-10 inline-flex cursor-not-allowed items-center justify-center rounded-full border border-white/15 px-8 py-4 text-sm text-white/40">Preorder Closed</span>
      <p className="mx-auto mt-5 max-w-lg text-xs leading-5 text-white/32">Batch 2 preorder closed on 13 August 2026 at 23.59 WIB. Production is now in progress.</p>
    </>
  );
}
