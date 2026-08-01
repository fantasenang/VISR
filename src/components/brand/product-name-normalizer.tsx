"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const LEGACY_NAME = "VISR Carry Gen 2";
const CURRENT_NAME = "VISR Carry";
const ATTRIBUTE_NAMES = ["aria-label", "alt", "title", "placeholder"] as const;
const META_PIXEL_ID =
  process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || "1558889889220021";

type MetaPixelFunction = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[][];
  loaded?: boolean;
  version?: string;
  push?: MetaPixelFunction;
};

declare global {
  interface Window {
    fbq?: MetaPixelFunction;
    _fbq?: MetaPixelFunction;
    __visrMetaPixelInitialized?: boolean;
  }
}

function normalizeText(value: string) {
  return value.replaceAll(LEGACY_NAME, CURRENT_NAME);
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

function initializeMetaPixel() {
  if (!window.fbq) {
    const fbq = ((...args: unknown[]) => {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue?.push(args);
    }) as MetaPixelFunction;

    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    window.fbq = fbq;
    window._fbq = fbq;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    script.dataset.visrMetaPixel = "true";
    document.head.appendChild(script);
  }

  if (!window.__visrMetaPixelInitialized) {
    window.fbq?.("init", META_PIXEL_ID);
    window.__visrMetaPixelInitialized = true;
  }
}

function trackProductSections() {
  const products = [
    {
      selector: "#link-system",
      key: "link-system",
      parameters: {
        content_ids: ["VISR-LINK"],
        content_name: "VISR Link",
        content_type: "product",
        content_category: "Magnetic display interface",
        currency: "IDR",
      },
    },
    {
      selector: "#carry",
      key: "visr-carry",
      parameters: {
        content_ids: ["VISR-CARRY-G2"],
        content_name: "VISR Carry",
        content_type: "product",
        content_category: "Portable diecast display",
        value: 179000,
        currency: "IDR",
      },
    },
    {
      selector: "#halo",
      key: "halo-collection",
      parameters: {
        content_ids: ["HALO-COLLECTION"],
        content_name: "Halo Collection",
        content_type: "product",
        content_category: "Coming Soon",
        currency: "IDR",
      },
    },
  ];

  const observed = new Set<Element>();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const item = products.find(
          (product) => document.querySelector(product.selector) === entry.target,
        );
        if (!item) continue;

        const storageKey = `visr-meta-view:${item.key}`;
        if (sessionStorage.getItem(storageKey) !== "1") {
          window.fbq?.("track", "ViewContent", item.parameters);
          sessionStorage.setItem(storageKey, "1");
        }
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.35 },
  );

  const attach = () => {
    for (const product of products) {
      const element = document.querySelector(product.selector);
      if (!element || observed.has(element)) continue;
      observed.add(element);
      observer.observe(element);
    }
  };

  attach();
  const mutationObserver = new MutationObserver(attach);
  mutationObserver.observe(document.body, { childList: true, subtree: true });

  return () => {
    mutationObserver.disconnect();
    observer.disconnect();
  };
}

export function ProductNameNormalizer() {
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);

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

  useEffect(() => {
    if (pathname.startsWith("/visr-control")) return;

    initializeMetaPixel();
    if (lastTrackedPath.current !== pathname) {
      window.fbq?.("track", "PageView");
      lastTrackedPath.current = pathname;
    }

    if (pathname !== "/") return;
    return trackProductSections();
  }, [pathname]);

  return null;
}
