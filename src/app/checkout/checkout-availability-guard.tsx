"use client";

import { useEffect } from "react";

function findCarryArticle() {
  const heading = Array.from(document.querySelectorAll<HTMLHeadingElement>("h2")).find(
    (element) => element.textContent?.trim() === "VISR Carry",
  );

  return heading?.closest("article") as HTMLElement | null;
}

function findQuantityControl(article: HTMLElement) {
  return Array.from(article.querySelectorAll<HTMLElement>("div")).find((element) => {
    const buttons = element.querySelectorAll(":scope > button");
    const value = element.querySelector(":scope > span");
    return buttons.length === 2 && value && /^\d+$/.test(value.textContent?.trim() ?? "");
  });
}

function applyCarryComingSoonState() {
  const article = findCarryArticle();
  if (!article) return;

  article.dataset.visrComingSoon = "true";

  const header = article.querySelector("h2")?.parentElement?.parentElement;
  const price = header
    ? Array.from(header.children).find(
        (element) =>
          element instanceof HTMLParagraphElement &&
          /^Rp\s*/i.test(element.textContent?.trim() ?? ""),
      )
    : null;

  if (price instanceof HTMLElement) {
    price.textContent = "Coming Soon";
    price.className =
      "rounded-full border border-white/15 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/55";
  }

  const availability = Array.from(article.querySelectorAll<HTMLElement>("p")).find(
    (element) => /available$/i.test(element.textContent?.trim() ?? ""),
  );

  if (availability) {
    availability.textContent = "Batch 2 preorder opens soon";
  }

  const quantityControl = findQuantityControl(article);
  if (quantityControl) {
    quantityControl.style.display = "none";
  }
}

export default function CheckoutAvailabilityGuard() {
  useEffect(() => {
    let frame = 0;

    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(applyCarryComingSoonState);
    };

    const blockCarryInteraction = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const article = target?.closest<HTMLElement>("[data-visr-coming-soon='true']");
      if (!article) return;

      const button = target?.closest("button");
      if (!button) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    applyCarryComingSoonState();

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    document.addEventListener("click", blockCarryInteraction, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", blockCarryInteraction, true);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
