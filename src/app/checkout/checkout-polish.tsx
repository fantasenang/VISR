"use client";

import { useEffect } from "react";

const FRIENDLY_ERRORS: Record<string, string> = {
  RAJAONGKIR_REQUEST_FAILED: "Ongkir belum dapat dihitung. Silakan periksa kode pos atau coba kembali beberapa saat lagi.",
  RAJAONGKIR_RATE_LIMITED: "Layanan ongkir sedang sibuk. Silakan coba kembali beberapa saat lagi.",
  RAJAONGKIR_NOT_CONFIGURED: "Layanan ongkir sementara belum tersedia.",
};

function polishCheckout() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();

  while (node) {
    const current = node.textContent ?? "";
    let next = current;

    for (const [technical, friendly] of Object.entries(FRIENDLY_ERRORS)) {
      next = next.replaceAll(technical, friendly);
    }

    next = next.replace(/(\d+)\s+day\s+days/gi, "Estimasi $1 hari");
    next = next.replace(/(\d+)\s+days/gi, "Estimasi $1 hari");

    if (next !== current) node.textContent = next;
    node = walker.nextNode();
  }

  const summary = Array.from(document.querySelectorAll("aside div")).find((element) =>
    element.textContent?.includes("Reservation Summary"),
  );
  if (!summary) return;

  const shippingRow = Array.from(summary.querySelectorAll("div")).find((element) => {
    const text = element.textContent?.trim();
    return text === "Shipping—" || text === "Shipping–" || text === "Shipping—";
  });
  if (!shippingRow) return;

  const rateButton = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => {
    const text = button.textContent ?? "";
    const isRate = /Rp\s*[\d.]+/.test(text) && /(JNE|J&T|Jalur Nugraha|Express)/i.test(text);
    return isRate && !button.disabled;
  });

  rateButton?.click();
}

export default function CheckoutPolish() {
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(polishCheckout);
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
