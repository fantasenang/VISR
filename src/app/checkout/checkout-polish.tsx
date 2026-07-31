"use client";

import { useEffect } from "react";

const FRIENDLY_ERRORS: Record<string, string> = {
  RAJAONGKIR_REQUEST_FAILED: "Ongkir belum dapat dihitung. Silakan periksa kode pos atau coba kembali beberapa saat lagi.",
  RAJAONGKIR_RATE_LIMITED: "Layanan ongkir sedang sibuk. Silakan coba kembali beberapa saat lagi.",
  RAJAONGKIR_NOT_CONFIGURED: "Layanan ongkir sementara belum tersedia.",
};

const COPY_REPLACEMENTS: Array<[string, string]> = [
  ["VISR Private Reservation", "VISR Carry Gen 2 — Batch 2 Preorder"],
  ["Complete your Batch 2 reservation.", "Reserve your VISR Carry Gen 2."],
  ["Choose your halo.", "Add a Halo Collection."],
  ["Each Halo is 150 g. One per color.", "Optional add-on · sold separately · one per color"],
  ["25 g each · for wall, desk, and future VISR systems.", "Optional add-on for wall, desk, and future VISR systems."],
  ["Review Reservation", "Review Preorder"],
  ["Create Reservation", "Confirm Preorder"],
  ["Reservation Summary", "Preorder Summary"],
  ["Reservation Confirmed", "Preorder Reserved"],
];

const STEP_BUTTON_LABELS = new Set([
  "Continue to Information",
  "Back",
  "Review Reservation",
  "Review Preorder",
  "Edit Information",
  "Create Reservation",
  "Confirm Preorder",
]);

function replaceCheckoutCopy() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();

  while (node) {
    const current = node.textContent ?? "";
    let next = current;

    for (const [technical, friendly] of Object.entries(FRIENDLY_ERRORS)) {
      next = next.replaceAll(technical, friendly);
    }

    for (const [from, to] of COPY_REPLACEMENTS) {
      next = next.replaceAll(from, to);
    }

    next = next.replace(/(\d+)\s+day\s+days/gi, "Estimasi $1 hari");
    next = next.replace(/(\d+)\s+days/gi, "Estimasi $1 hari");

    if (next !== current) node.textContent = next;
    node = walker.nextNode();
  }
}

function addPreorderNotice() {
  if (document.querySelector("[data-visr-preorder-notice]")) return;

  const header = Array.from(document.querySelectorAll<HTMLElement>("main > div > div")).find((element) =>
    element.textContent?.includes("Reserve your VISR Carry Gen 2."),
  );
  if (!header) return;

  const notice = document.createElement("div");
  notice.dataset.visrPreorderNotice = "true";
  notice.className = "mb-10 grid gap-5 rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 text-sm leading-6 text-white/55 md:grid-cols-3 md:p-8";
  notice.innerHTML = `
    <div><p class="visr-label text-white/35">Preorder Opens</p><p class="mt-2 text-base text-white/80">7 August 2026</p></div>
    <div><p class="visr-label text-white/35">Production</p><p class="mt-2 text-base text-white/80">Maximum 14 business days after preorder closes</p></div>
    <div><p class="visr-label text-white/35">Dispatch</p><p class="mt-2 text-base text-white/80">Sent immediately after final inspection</p></div>
    <p class="md:col-span-3 text-xs leading-5 text-white/40">Preorder price Rp179.000. Ready-stock price Rp199.000. Finished units are dispatched without waiting for the entire batch to be completed.</p>
  `;
  header.insertAdjacentElement("afterend", notice);
}

function addReviewAcknowledgement() {
  if (document.querySelector("[data-visr-preorder-acknowledgement]")) return;

  const confirmButton = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
    button.textContent?.trim() === "Confirm Preorder",
  );
  if (!confirmButton) return;

  const actions = confirmButton.parentElement;
  if (!actions) return;

  const acknowledgement = document.createElement("div");
  acknowledgement.dataset.visrPreorderAcknowledgement = "true";
  acknowledgement.className = "rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-xs leading-6 text-white/50";
  acknowledgement.textContent =
    "By confirming, you acknowledge that this is a preorder. Production starts after the preorder period closes and takes a maximum of 14 business days. Units are dispatched immediately after passing final inspection.";
  actions.insertAdjacentElement("beforebegin", acknowledgement);
}

function hideEmptyPackingProfile() {
  const summary = Array.from(document.querySelectorAll<HTMLElement>("aside div")).find((element) =>
    element.textContent?.includes("Preorder Summary"),
  );
  if (!summary) return;

  const totalIsZero = summary.textContent?.includes("TotalRp 0") || summary.textContent?.includes("TotalRp 0");
  const packingProfile = Array.from(summary.querySelectorAll<HTMLElement>("div")).find((element) =>
    element.textContent?.includes("actual weight") && element.textContent?.includes("packing profile"),
  );
  if (packingProfile) packingProfile.style.display = totalIsZero ? "none" : "";
}

function selectFirstShippingRate() {
  const summary = Array.from(document.querySelectorAll("aside div")).find((element) =>
    element.textContent?.includes("Preorder Summary"),
  );
  if (!summary) return;

  const shippingRow = Array.from(summary.querySelectorAll("div")).find((element) => {
    const text = element.textContent?.trim();
    return text === "Shipping—" || text === "Shipping–";
  });
  if (!shippingRow) return;

  const rateButton = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => {
    const text = button.textContent ?? "";
    const isRate = /Rp\s*[\d.]+/.test(text) && /(JNE|J&T|Jalur Nugraha|Express)/i.test(text);
    return isRate && !button.disabled;
  });

  rateButton?.click();
}

function polishCheckout() {
  document.querySelectorAll<HTMLElement>("input, textarea, select").forEach((field) => {
    field.style.fontSize = "16px";
  });

  replaceCheckoutCopy();
  addPreorderNotice();
  addReviewAcknowledgement();
  hideEmptyPackingProfile();
  selectFirstShippingRate();
}

export default function CheckoutPolish() {
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(polishCheckout);
    };

    const handleStepClick = (event: MouseEvent) => {
      const button = (event.target as HTMLElement | null)?.closest("button");
      if (!button || button.disabled) return;

      const label = button.textContent?.trim() ?? "";
      if (!STEP_BUTTON_LABELS.has(label)) return;

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        });
      });
    };

    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    document.addEventListener("click", handleStepClick);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", handleStepClick);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
