"use client";

import { useEffect } from "react";
import { META_CONSENT_MARKER } from "@/lib/privacy/consent";

const LEGACY_NAME = "VISR Carry Gen 2";
const CURRENT_NAME = "VISR Carry";
const ATTRIBUTE_NAMES = ["aria-label", "alt", "title", "placeholder"] as const;

function normalizeText(value: string) {
  return value
    .replaceAll(LEGACY_NAME, CURRENT_NAME)
    .replaceAll(META_CONSENT_MARKER, "")
    .replace(/\n{3,}/g, "\n\n");
}

function normalizeNode(root: ParentNode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();

  while (node) {
    const current = node.textContent ?? "";
    const next = normalizeText(current);
    if (next !== current) node.textContent = next;
    node = walker.nextNode();
  }

  if (root instanceof Element) {
    const elements = [root, ...Array.from(root.querySelectorAll("*"))];
    for (const element of elements) {
      for (const attribute of ATTRIBUTE_NAMES) {
        const current = element.getAttribute(attribute);
        if (!current) continue;
        const next = normalizeText(current);
        if (next !== current) element.setAttribute(attribute, next);
      }
    }
  }

  document.title = normalizeText(document.title);
}

export function ProductNameNormalizer() {
  useEffect(() => {
    normalizeNode(document.body);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          const current = mutation.target.textContent ?? "";
          const next = normalizeText(current);
          if (next !== current) mutation.target.textContent = next;
          continue;
        }

        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) normalizeNode(node);
          else if (node.nodeType === Node.TEXT_NODE) {
            const current = node.textContent ?? "";
            const next = normalizeText(current);
            if (next !== current) node.textContent = next;
          }
        });
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
