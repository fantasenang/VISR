"use client";

import { useEffect } from "react";

type SessionResponse = {
  redirectUrl?: string;
  error?: { message?: string };
};

function orderNumberFromPage() {
  return document.body.innerText.match(/VISR\.B\d{2}\.\d{8}\.\d{3,}/)?.[0] ?? null;
}

function replaceMidtransCopy() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();

  while (node) {
    const value = node.textContent ?? "";
    if (value.includes("Midtrans")) {
      node.textContent = value
        .replaceAll("with Midtrans", "via QRIS BCA")
        .replaceAll("Midtrans", "QRIS BCA");
    }
    node = walker.nextNode();
  }
}

function installPaymentOverride() {
  replaceMidtransCopy();

  const button = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => {
    const label = candidate.textContent ?? "";
    return label.includes("QRIS BCA") || label.includes("Opening secure payment");
  });

  if (!button || button.dataset.qrisOverride === "true") return;
  button.dataset.qrisOverride = "true";

  button.addEventListener(
    "click",
    async (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const orderNumber = orderNumberFromPage();
      if (!orderNumber) {
        window.alert("Order number could not be read. Refresh checkout and try again.");
        return;
      }

      const previousLabel = button.textContent ?? "Continue to QRIS";
      button.disabled = true;
      button.textContent = "Opening QRIS…";

      try {
        const response = await fetch("/api/payments/qris/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderNumber }),
        });
        const payload = (await response.json().catch(() => ({}))) as SessionResponse;
        if (!response.ok || !payload.redirectUrl) {
          throw new Error(payload.error?.message ?? "QRIS payment could not be opened.");
        }
        window.location.assign(payload.redirectUrl);
      } catch (error) {
        button.disabled = false;
        button.textContent = previousLabel;
        window.alert(error instanceof Error ? error.message : "QRIS payment could not be opened.");
      }
    },
    { capture: true },
  );
}

export default function QrisPaymentOverride() {
  useEffect(() => {
    installPaymentOverride();
    const observer = new MutationObserver(installPaymentOverride);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
