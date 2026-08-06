"use client";

import { useEffect, useRef, useState } from "react";

const ORDER_NUMBER_PATTERN = /VISR\.B\d{2}\.\d{8}\.\d{3,}/;
const STORAGE_PREFIX = "visr-order-number-saved:";

function findVisibleOrderNumber() {
  return document.body.innerText.match(ORDER_NUMBER_PATTERN)?.[0] ?? null;
}

export default function OrderNumberSavePrompt() {
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const acknowledgedNumbersRef = useRef(new Set<string>());
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const detectOrderNumber = () => {
      const detected = findVisibleOrderNumber();
      if (!detected || acknowledgedNumbersRef.current.has(detected)) return;

      try {
        if (window.sessionStorage.getItem(`${STORAGE_PREFIX}${detected}`) === "true") return;
      } catch {
        // The in-memory acknowledgement still prevents the prompt from reopening.
      }

      setOrderNumber((current) => current ?? detected);
    };

    detectOrderNumber();
    const observer = new MutationObserver(detectOrderNumber);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!orderNumber) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => confirmButtonRef.current?.focus());

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [orderNumber]);

  const copyOrderNumber = async () => {
    if (!orderNumber) return;

    try {
      await navigator.clipboard.writeText(orderNumber);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const confirmSaved = () => {
    if (!orderNumber) return;

    acknowledgedNumbersRef.current.add(orderNumber);
    document.documentElement.dataset.visrSavedOrderNumber = orderNumber;

    try {
      window.sessionStorage.setItem(`${STORAGE_PREFIX}${orderNumber}`, "true");
    } catch {
      // The page-level acknowledgement is enough for the current checkout session.
    }

    setOrderNumber(null);
    setCopied(false);
  };

  if (!orderNumber) return null;

  return (
    <div
      className="fixed inset-0 z-[250] flex items-end justify-center bg-black/82 px-4 pb-4 pt-16 backdrop-blur-md sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-number-prompt-title"
      aria-describedby="order-number-prompt-description"
    >
      <div className="w-full max-w-md rounded-[2rem] border border-white/14 bg-[#080808] p-6 text-white shadow-2xl sm:p-8">
        <p className="visr-label text-white/40">Reservation created</p>
        <h2
          id="order-number-prompt-title"
          className="mt-4 text-3xl font-normal leading-tight tracking-[-0.04em]"
        >
          Save your order number.
        </h2>
        <p
          id="order-number-prompt-description"
          className="mt-4 text-sm leading-6 text-white/52"
        >
          You will need this number to track your order and contact VISR support. Copy it or take a screenshot before continuing to payment.
        </p>

        <div className="mt-7 rounded-2xl border border-white/12 bg-white/[0.045] p-5 text-center">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Order number</p>
          <p className="mt-3 break-all text-3xl tracking-[-0.035em] text-white">{orderNumber}</p>
          <button
            type="button"
            onClick={copyOrderNumber}
            className="mt-5 rounded-full border border-white/16 px-5 py-2.5 text-xs font-medium transition hover:border-white/35 hover:bg-white/[0.05]"
          >
            {copied ? "Copied" : "Copy order number"}
          </button>
        </div>

        <p className="mt-5 text-center text-xs leading-5 text-white/36">
          This confirmation does not submit payment.
        </p>

        <button
          ref={confirmButtonRef}
          type="button"
          onClick={confirmSaved}
          className="mt-6 w-full rounded-full bg-white px-6 py-4 text-sm font-medium text-black transition hover:bg-white/88 focus:outline-none focus:ring-2 focus:ring-white/55 focus:ring-offset-2 focus:ring-offset-[#080808]"
        >
          I’ve saved my order number
        </button>
      </div>
    </div>
  );
}
