"use client";

import { useEffect } from "react";

const FRIENDLY_ERRORS: Record<string, string> = {
  RAJAONGKIR_REQUEST_FAILED:
    "Ongkir belum dapat dihitung. Silakan periksa kode pos atau coba kembali beberapa saat lagi.",
  RAJAONGKIR_RATE_LIMITED:
    "Layanan ongkir sedang sibuk. Silakan coba kembali beberapa saat lagi.",
  RAJAONGKIR_NOT_CONFIGURED: "Layanan ongkir sementara belum tersedia.",
};

const COPY_REPLACEMENTS: Array<[string, string]> = [
  ["VISR Carry Gen 2", "VISR Carry"],
  ["VISR Private Reservation", "VISR Carry — Batch 2 Preorder"],
  ["Complete your Batch 2 reservation.", "Reserve your VISR Carry."],
  ["Choose your halo.", "Preview Halo Collection."],
  [
    "Each Halo is 150 g. One per color.",
    "Explore every colored edge. Halo Collection will be available separately.",
  ],
  ["Add a Halo Collection.", "Preview Halo Collection."],
  [
    "Optional add-on · sold separately · one per color",
    "Explore every colored edge. Available separately soon.",
  ],
  [
    "25 g each · for wall, desk, and future VISR systems.",
    "Optional add-on for wall, desk, and future VISR systems.",
  ],
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

const PRODUCT_FRAME_COPY = {
  carry: "VISR Carry",
  link: "Additional VISR Link",
} as const;

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

  const header = Array.from(
    document.querySelectorAll<HTMLElement>("main > div > div"),
  ).find((element) =>
    element.textContent?.includes("Reserve your VISR Carry."),
  );

  if (!header) return;

  const notice = document.createElement("div");
  notice.dataset.visrPreorderNotice = "true";
  notice.className =
    "mb-10 grid gap-5 rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 text-sm leading-6 text-white/55 md:grid-cols-3 md:p-8";
  notice.innerHTML = `
    <div><p class="visr-label text-white/35">Preorder Opens</p><p class="mt-2 text-base text-white/80">7 August 2026</p></div>
    <div><p class="visr-label text-white/35">Preorder Closes</p><p class="mt-2 text-base text-white/80">13 August · 23.59 WIB</p></div>
    <div><p class="visr-label text-white/35">Estimated Dispatch</p><p class="mt-2 text-base text-white/80">18–25 August 2026</p></div>
    <p class="md:col-span-3 text-xs leading-5 text-white/40">Production runs progressively before and throughout the preorder period. Finished units are dispatched in order sequence after passing final inspection.</p>
  `;
  header.insertAdjacentElement("afterend", notice);
}

function addReviewAcknowledgement() {
  if (document.querySelector("[data-visr-preorder-acknowledgement]")) return;

  const confirmButton = Array.from(
    document.querySelectorAll<HTMLButtonElement>("button"),
  ).find((button) => button.textContent?.trim() === "Confirm Preorder");

  if (!confirmButton) return;

  const actions = confirmButton.parentElement;
  if (!actions) return;

  const acknowledgement = document.createElement("div");
  acknowledgement.dataset.visrPreorderAcknowledgement = "true";
  acknowledgement.className =
    "rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-xs leading-6 text-white/50";
  acknowledgement.textContent =
    "By confirming, you acknowledge that this is a preorder with estimated dispatch between 18 and 25 August 2026. Units are dispatched in order sequence after passing final inspection.";
  actions.insertAdjacentElement("beforebegin", acknowledgement);
}

function findSummary() {
  return Array.from(document.querySelectorAll<HTMLElement>("aside div")).find(
    (element) => element.textContent?.includes("Preorder Summary"),
  );
}

function hideEmptyPackingProfile() {
  const summary = findSummary();
  if (!summary) return;

  const totalIsZero =
    summary.textContent?.includes("TotalRp 0") ||
    summary.textContent?.includes("TotalRp 0");

  const packingProfile = Array.from(
    summary.querySelectorAll<HTMLElement>("div"),
  ).find(
    (element) =>
      element.textContent?.includes("actual weight") &&
      element.textContent?.includes("packing profile"),
  );

  if (packingProfile) {
    packingProfile.style.display = totalIsZero ? "none" : "";
  }
}

function selectFirstShippingRate() {
  const summary = findSummary();
  if (!summary) return;

  const shippingRow = Array.from(summary.querySelectorAll("div")).find(
    (element) => {
      const text = element.textContent?.trim();
      return text === "Shipping—" || text === "Shipping–";
    },
  );

  if (!shippingRow) return;

  const rateButton = Array.from(
    document.querySelectorAll<HTMLButtonElement>("button"),
  ).find((button) => {
    const text = button.textContent ?? "";
    const isRate =
      /Rp\s*[\d.]+/.test(text) &&
      /(JNE|J&T|Jalur Nugraha|Express)/i.test(text);
    return isRate && !button.disabled;
  });

  rateButton?.click();
}

function findProductArticle(title: string) {
  const heading = Array.from(document.querySelectorAll<HTMLHeadingElement>("h2")).find(
    (element) => element.textContent?.trim() === title,
  );

  return heading?.closest("article") as HTMLElement | null;
}

function readQuantity(article: HTMLElement) {
  const quantityControl = Array.from(article.querySelectorAll<HTMLElement>("div")).find(
    (element) => {
      const buttons = element.querySelectorAll(":scope > button");
      const value = element.querySelector(":scope > span");
      return buttons.length === 2 && value && /^\d+$/.test(value.textContent?.trim() ?? "");
    },
  );

  const value = Number(
    quantityControl?.querySelector(":scope > span")?.textContent?.trim() ?? "0",
  );

  return {
    value: Number.isFinite(value) ? value : 0,
    quantityControl,
  };
}

function ensureFrameGlow(article: HTMLElement) {
  article.style.position = "relative";
  article.style.overflow = "hidden";
  article.style.transition =
    "border-color 420ms ease, background-color 420ms ease, box-shadow 420ms ease";

  let glow = article.querySelector<HTMLElement>("[data-visr-frame-glow]");

  if (!glow) {
    glow = document.createElement("span");
    glow.dataset.visrFrameGlow = "true";
    glow.setAttribute("aria-hidden", "true");
    Object.assign(glow.style, {
      position: "absolute",
      top: "0",
      right: "12%",
      left: "12%",
      height: "1px",
      pointerEvents: "none",
      background: "white",
      filter: "blur(0.5px)",
      opacity: "0",
      transition: "opacity 420ms ease",
    });
    article.prepend(glow);
  }

  return glow;
}

function applyProductFrameState(article: HTMLElement) {
  const { value, quantityControl } = readQuantity(article);
  const active = value > 0;
  const glow = ensureFrameGlow(article);

  article.dataset.visrSelected = String(active);
  glow.style.opacity = active ? "1" : "0";

  if (active) {
    article.style.borderColor = "rgb(255 255 255 / 0.78)";
    article.style.backgroundColor = "rgb(255 255 255 / 0.045)";
    article.style.boxShadow =
      "0 0 0 1px rgb(255 255 255 / 0.16), 0 0 34px rgb(255 255 255 / 0.22), inset 0 0 26px rgb(255 255 255 / 0.05)";
  } else {
    article.style.borderColor = "";
    article.style.backgroundColor = "";
    article.style.boxShadow = "";
  }

  if (!quantityControl) return;

  quantityControl.style.transition =
    "border-color 300ms ease, background-color 300ms ease, box-shadow 300ms ease";

  if (active) {
    quantityControl.style.borderColor = "rgb(255 255 255 / 0.7)";
    quantityControl.style.backgroundColor = "rgb(255 255 255 / 0.06)";
    quantityControl.style.boxShadow = "0 0 18px rgb(255 255 255 / 0.18)";
  } else {
    quantityControl.style.borderColor = "";
    quantityControl.style.backgroundColor = "";
    quantityControl.style.boxShadow = "";
  }
}

function polishProductFrames() {
  const carry = findProductArticle(PRODUCT_FRAME_COPY.carry);
  const link = findProductArticle(PRODUCT_FRAME_COPY.link);

  if (carry) applyProductFrameState(carry);
  if (link) applyProductFrameState(link);
}

function findHaloArticle() {
  const label = Array.from(document.querySelectorAll<HTMLElement>("p")).find(
    (element) => element.textContent?.trim() === "Halo Collection",
  );

  return label?.closest("article") as HTMLElement | null;
}

function setHaloPreviewSelection(
  article: HTMLElement,
  selectedButton: HTMLButtonElement,
) {
  const buttons = Array.from(
    article.querySelectorAll<HTMLButtonElement>("[data-visr-halo-option]"),
  );

  buttons.forEach((button) => {
    button.dataset.visrPreviewSelected = "false";
    button.setAttribute("aria-pressed", "false");
    button.style.borderColor = "";
    button.style.boxShadow = "";
    button.style.backgroundColor = "";
  });

  const rgb =
    selectedButton.style.getPropertyValue("--halo-button-rgb").trim() ||
    "255 255 255";

  selectedButton.dataset.visrPreviewSelected = "true";
  selectedButton.setAttribute("aria-pressed", "true");
  selectedButton.style.borderColor = `rgb(${rgb} / 0.9)`;
  selectedButton.style.backgroundColor = "rgb(255 255 255 / 0.06)";
  selectedButton.style.boxShadow = `0 0 0 1px rgb(${rgb} / 0.28), 0 0 22px rgb(${rgb} / 0.32), inset 0 0 18px rgb(${rgb} / 0.08)`;
}

function polishHaloPreview() {
  const article = findHaloArticle();
  if (!article) return;

  article.dataset.visrHaloPreview = "true";

  const heading = article.querySelector("h2");
  if (heading && heading.textContent !== "Preview Halo Collection.") {
    heading.textContent = "Preview Halo Collection.";
  }

  const headingContainer = heading?.parentElement;
  const description = headingContainer
    ? Array.from(headingContainer.querySelectorAll("p")).find(
        (element) => !element.classList.contains("visr-label"),
      )
    : null;

  if (
    description &&
    description.textContent !==
      "Explore every colored edge. Halo Collection will be available separately."
  ) {
    description.textContent =
      "Explore every colored edge. Halo Collection will be available separately.";
  }

  const header = headingContainer?.parentElement;
  const status = header
    ? Array.from(header.children).find(
        (element) =>
          element instanceof HTMLParagraphElement &&
          /^Rp\s*/i.test(element.textContent?.trim() ?? ""),
      )
    : null;

  if (status instanceof HTMLElement) {
    status.textContent = "Coming Soon";
    status.className =
      "rounded-full border border-white/15 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/55";
  }

  const buttons = Array.from(article.querySelectorAll<HTMLButtonElement>("button"));

  buttons.forEach((button) => {
    button.dataset.visrHaloOption = "true";
    button.disabled = false;
    button.style.cursor = "pointer";

    const statusText = button.querySelector("span:nth-of-type(2)");
    if (statusText && statusText.textContent !== "Coming Soon") {
      statusText.textContent = "Coming Soon";
    }
  });

  const selected = buttons.find(
    (button) => button.dataset.visrPreviewSelected === "true",
  );

  if (selected) {
    setHaloPreviewSelection(article, selected);
  } else if (buttons[0]) {
    setHaloPreviewSelection(article, buttons[0]);
  }
}

function removeHaloFromSummary() {
  const summary = findSummary();
  if (!summary) return;

  Array.from(summary.querySelectorAll<HTMLElement>("div")).forEach((row) => {
    const text = row.textContent?.trim() ?? "";
    if (/Halo (Crimson|Ice|Emerald|Amber|Pink)/i.test(text)) {
      row.style.display = "none";
    }
  });
}

function polishCheckout() {
  document
    .querySelectorAll<HTMLElement>("input, textarea, select")
    .forEach((field) => {
      field.style.fontSize = "16px";
    });

  replaceCheckoutCopy();
  addPreorderNotice();
  addReviewAcknowledgement();
  polishHaloPreview();
  polishProductFrames();
  removeHaloFromSummary();
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

    const handleHaloPreviewClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLButtonElement>(
        "[data-visr-halo-option]",
      );

      if (!button) return;

      const article = button.closest<HTMLElement>("[data-visr-halo-preview]");
      if (!article) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setHaloPreviewSelection(article, button);
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

    polishCheckout();

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    document.addEventListener("click", handleHaloPreviewClick, true);
    document.addEventListener("click", handleStepClick);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", handleHaloPreviewClick, true);
      document.removeEventListener("click", handleStepClick);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
