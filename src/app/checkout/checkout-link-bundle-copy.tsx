"use client";

import { useEffect } from "react";

const CURRENT_COPY = "Optional add-on for wall, desk, and future VISR systems.";
const BUNDLE_COPY =
  "Bundle an extra VISR Link for another car, so you can swap displays without removing and reinstalling the Link.";

function applyLinkBundleCopy() {
  const heading = Array.from(document.querySelectorAll<HTMLHeadingElement>("h2")).find(
    (element) => element.textContent?.trim() === "Additional VISR Link",
  );

  const article = heading?.closest("article");
  if (!article) return;

  const description = Array.from(article.querySelectorAll<HTMLParagraphElement>("p")).find(
    (element) => element.textContent?.trim() === CURRENT_COPY,
  );

  if (description) description.textContent = BUNDLE_COPY;
}

export default function CheckoutLinkBundleCopy() {
  useEffect(() => {
    let frame = 0;

    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(applyLinkBundleCopy);
    };

    applyLinkBundleCopy();

    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
