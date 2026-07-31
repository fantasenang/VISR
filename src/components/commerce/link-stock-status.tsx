"use client";

import { useEffect, useState } from "react";

type StockItem = { remaining: number; soldOut: boolean };
type StockPayload = { products?: Record<string, StockItem> };

export function LinkStockStatus() {
  const [stock, setStock] = useState<StockItem | null>(null);

  useEffect(() => {
    const loadStock = async () => {
      try {
        const response = await fetch("/api/stock", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as StockPayload;
        setStock(payload.products?.["VISR-LINK-ADD"] ?? null);
      } catch {
        // Keep a stable fallback label during a temporary lookup failure.
      }
    };

    void loadStock();
    const timer = window.setInterval(loadStock, 10_000);
    return () => window.clearInterval(timer);
  }, []);

  const label = !stock
    ? "Available"
    : stock.soldOut
      ? "Sold Out"
      : stock.remaining <= 25
        ? "Low Stock"
        : "Available";

  return (
    <span
      className="mt-3 inline-flex rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-white/45"
      aria-live="polite"
    >
      {label}
    </span>
  );
}
