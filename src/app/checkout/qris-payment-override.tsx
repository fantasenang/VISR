"use client";

import { useEffect } from "react";
import { ORDER_ACCESS_STORAGE_KEY } from "./checkout-order-access-bridge";

type SessionResponse = {
  redirectUrl?: string;
  error?: { message?: string };
};

type StoredOrderAccess = {
  orderId?: string;
  orderNumber?: string;
};

const COPY_REPLACEMENTS: Array<[string, string]> = [
  [
    "Midtrans will handle the payment securely, while the webhook confirms the final payment status.",
    "VISR verifies QRIS payments manually against the BCA transaction record after you submit confirmation.",
  ],
  [
    "Payments are verified server-side through Midtrans notifications.",
    "QRIS payments are verified manually against the BCA transaction record.",
  ],
];

function orderNumberFromPage() {
  return document.body.innerText.match(/VISR\.B\d{2}\.\d{8}\.\d{3,}/)?.[0] ?? null;
}

function readOrderAccess() {
  try {
    const raw = window.sessionStorage.getItem(ORDER_ACCESS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredOrderAccess) : null;
  } catch {
    return null;
  }
}

function replacePaymentCopy() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();

  while (node) {
    const current = node.textContent ?? "";
    let next = current;

    for (const [from, to] of COPY_REPLACEMENTS) {
      next = next.replaceAll(from, to);
    }

    if (next !== current) node.textContent = next;
    node = walker.nextNode();
  }
}

function findPaymentButton() {
  return Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => {
    const label = candidate.textContent ?? "";
    return (
      (/^Pay\s+Rp/i.test(label) && label.includes("Midtrans")) ||
      label === "Continue to QRIS BCA" ||
      label.includes("Opening secure payment") ||
      label.includes("Opening QRIS")
    );
  });
}

function installPaymentOverride() {
  replacePaymentCopy();

  const button = findPaymentButton();
  if (!button) return;

  if (button.dataset.qrisOverride !== "true") {
    button.dataset.qrisOverride = "true";
    button.textContent = "Continue to QRIS BCA";

    button.addEventListener(
      "click",
      async (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        const orderNumber = orderNumberFromPage();
        const access = readOrderAccess();
        const orderId = access?.orderId;

        if (!orderId || !orderNumber || (access?.orderNumber && access.orderNumber !== orderNumber)) {
          window.alert("Order access is not valid. Refresh checkout and create the reservation again.");
          return;
        }

        button.disabled = true;
        button.textContent = "Opening QRIS…";

        try {
          const response = await fetch("/api/payments/qris/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId }),
          });
          const payload = (await response.json().catch(() => ({}))) as SessionResponse;
          if (!response.ok || !payload.redirectUrl) {
            throw new Error(payload.error?.message ?? "QRIS payment could not be opened.");
          }
          window.location.assign(payload.redirectUrl);
        } catch (error) {
          button.disabled = false;
          button.textContent = "Continue to QRIS BCA";
          window.alert(error instanceof Error ? error.message : "QRIS payment could not be opened.");
        }
      },
      { capture: true },
    );
  }
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
