"use client";

import { useEffect } from "react";

const ORDER_PATTERN = /^VISR\.B\d{2}\.\d{8}\.\d{3,}$/;

function resetHorizontalScroll() {
  window.scrollTo({ left: 0, top: window.scrollY, behavior: "instant" });
  document.documentElement.scrollLeft = 0;
  document.body.scrollLeft = 0;
}

function constrainCheckoutContent() {
  document.documentElement.style.maxWidth = "100%";
  document.documentElement.style.overflowX = "hidden";
  document.body.style.maxWidth = "100%";
  document.body.style.overflowX = "hidden";

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();

  while (node) {
    const value = node.textContent?.trim() ?? "";
    if (ORDER_PATTERN.test(value) && node.parentElement) {
      Object.assign(node.parentElement.style, {
        maxWidth: "100%",
        minWidth: "0",
        overflowWrap: "anywhere",
        wordBreak: "break-word",
        fontSize: "clamp(1.65rem, 7.8vw, 3rem)",
        lineHeight: "1.08",
      });
    }
    node = walker.nextNode();
  }
}

export default function CheckoutViewportGuard() {
  useEffect(() => {
    let frame = 0;

    const apply = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        constrainCheckoutContent();
        resetHorizontalScroll();
      });
    };

    apply();

    const observer = new MutationObserver(apply);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    window.addEventListener("pageshow", apply);
    window.addEventListener("orientationchange", apply);
    document.addEventListener("focusout", apply);
    window.visualViewport?.addEventListener("resize", apply);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("pageshow", apply);
      window.removeEventListener("orientationchange", apply);
      document.removeEventListener("focusout", apply);
      window.visualViewport?.removeEventListener("resize", apply);
    };
  }, []);

  return null;
}
