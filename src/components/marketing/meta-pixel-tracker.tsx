"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  TRACKING_CONSENT_EVENT,
  TRACKING_CONSENT_STORAGE_KEY,
  isTrackingConsent,
  type TrackingConsent,
} from "@/lib/privacy/consent";

const META_PIXEL_ID =
  process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || "1558889889220021";
const PREORDER_OPENS_AT = Date.parse("2026-08-07T00:00:00+07:00");

const CHECKOUT_PRODUCTS = [
  { title: "VISR Carry", sku: "VISR-CARRY-G2" },
  { title: "Additional VISR Link", sku: "VISR-LINK-ADD" },
] as const;

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

function storedConsent(): TrackingConsent | null {
  try {
    const value = window.localStorage.getItem(TRACKING_CONSENT_STORAGE_KEY);
    return isTrackingConsent(value) ? value : null;
  } catch {
    return null;
  }
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
  window.fbq?.("consent", "grant");
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

function parseRupiah(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function findCheckoutArticle(title: string) {
  const heading = Array.from(document.querySelectorAll<HTMLHeadingElement>("h2")).find(
    (element) => element.textContent?.trim() === title,
  );
  return heading?.closest("article") as HTMLElement | null;
}

function readCheckoutQuantity(article: HTMLElement) {
  const control = Array.from(article.querySelectorAll<HTMLElement>("div")).find(
    (element) => {
      const buttons = element.querySelectorAll(":scope > button");
      const value = element.querySelector(":scope > span");
      return buttons.length === 2 && value && /^\d+$/.test(value.textContent?.trim() ?? "");
    },
  );
  const value = Number(control?.querySelector(":scope > span")?.textContent?.trim() ?? "0");
  return Number.isFinite(value) ? value : 0;
}

function readCheckoutPrice(article: HTMLElement) {
  const price = Array.from(article.querySelectorAll<HTMLElement>("p")).find((element) =>
    /^Rp\s*/i.test(element.textContent?.trim() ?? ""),
  );
  return parseRupiah(price?.textContent ?? "");
}

function getCheckoutContents() {
  const contents: Array<{ id: string; quantity: number; item_price: number }> = [];
  let value = 0;

  for (const product of CHECKOUT_PRODUCTS) {
    const article = findCheckoutArticle(product.title);
    if (!article) continue;
    const quantity = readCheckoutQuantity(article);
    const itemPrice = readCheckoutPrice(article);
    if (quantity <= 0 || itemPrice <= 0) continue;
    contents.push({ id: product.sku, quantity, item_price: itemPrice });
    value += quantity * itemPrice;
  }

  return { contents, value };
}

function trackCheckoutViews() {
  if (Date.now() < PREORDER_OPENS_AT) return;

  for (const product of CHECKOUT_PRODUCTS) {
    const article = findCheckoutArticle(product.title);
    if (!article || article.dataset.visrMetaViewed === "true") continue;
    article.dataset.visrMetaViewed = "true";
    window.fbq?.("track", "ViewContent", {
      content_ids: [product.sku],
      content_name: product.title,
      content_type: "product",
      value: readCheckoutPrice(article),
      currency: "IDR",
    });
  }
}

function setupCheckoutTracking() {
  if (Date.now() < PREORDER_OPENS_AT) return () => undefined;

  const refreshViews = () => trackCheckoutViews();
  refreshViews();
  const mutationObserver = new MutationObserver(refreshViews);
  mutationObserver.observe(document.body, { childList: true, subtree: true });

  const handleClick = (event: MouseEvent) => {
    const button = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>("button");
    if (!button || button.disabled) return;

    const label = button.textContent?.trim() ?? "";
    const article = button.closest("article") as HTMLElement | null;

    if (label === "+" && article) {
      const product = CHECKOUT_PRODUCTS.find(
        (item) => article.querySelector("h2")?.textContent?.trim() === item.title,
      );
      if (!product) return;
      const before = readCheckoutQuantity(article);
      window.requestAnimationFrame(() => {
        const after = readCheckoutQuantity(article);
        if (after <= before) return;
        const itemPrice = readCheckoutPrice(article);
        window.fbq?.("track", "AddToCart", {
          content_ids: [product.sku],
          content_name: product.title,
          content_type: "product",
          contents: [{ id: product.sku, quantity: after - before, item_price: itemPrice }],
          value: itemPrice * (after - before),
          currency: "IDR",
        });
      });
      return;
    }

    if (label === "Continue to Information") {
      const cart = getCheckoutContents();
      if (cart.contents.length === 0) return;
      window.fbq?.("track", "InitiateCheckout", {
        content_ids: cart.contents.map((item) => item.id),
        content_type: "product",
        contents: cart.contents,
        num_items: cart.contents.reduce((total, item) => total + item.quantity, 0),
        value: cart.value,
        currency: "IDR",
      });
      return;
    }

    if (/^Pay\s+Rp/i.test(label) && /Midtrans/i.test(label)) {
      window.fbq?.("track", "AddPaymentInfo", {
        content_type: "product",
        value: parseRupiah(label),
        currency: "IDR",
      });
    }
  };

  document.addEventListener("click", handleClick);
  return () => {
    mutationObserver.disconnect();
    document.removeEventListener("click", handleClick);
  };
}

export function MetaPixelTracker() {
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);
  const [consent, setConsent] = useState<TrackingConsent | null>(null);

  useEffect(() => {
    setConsent(storedConsent());
    const handleConsent = (event: Event) => {
      const detail = (event as CustomEvent<{ choice?: unknown }>).detail;
      if (isTrackingConsent(detail?.choice)) setConsent(detail.choice);
    };
    window.addEventListener(TRACKING_CONSENT_EVENT, handleConsent);
    return () => window.removeEventListener(TRACKING_CONSENT_EVENT, handleConsent);
  }, []);

  useEffect(() => {
    if (pathname.startsWith("/visr-control")) return;
    if (consent !== "granted") {
      if (consent === "denied") window.fbq?.("consent", "revoke");
      return;
    }

    initializeMetaPixel();
    if (lastTrackedPath.current !== pathname) {
      window.fbq?.("track", "PageView");
      lastTrackedPath.current = pathname;
    }

    if (pathname === "/") return trackProductSections();
    if (pathname === "/checkout") return setupCheckoutTracking();
  }, [consent, pathname]);

  return null;
}
