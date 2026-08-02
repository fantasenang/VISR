"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { track } from "@vercel/analytics";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const HOME_SECTIONS = [
  { selector: "#preorder", section: "preorder" },
  { selector: "#link-system", section: "visr_link" },
  { selector: "#carry", section: "visr_carry" },
  { selector: "#halo", section: "halo_collection" },
  { selector: "#preorder-details", section: "preorder_details" },
  { selector: "#configure", section: "final_cta" },
  { selector: "#faq", section: "faq" },
] as const;

function safeTrack(name: string, data?: Record<string, string | number | boolean>) {
  try {
    track(name, data);
  } catch {
    // Analytics must never interrupt the shopping experience.
  }
}

function trackOnce(key: string, name: string, data?: Record<string, string | number | boolean>) {
  try {
    const storageKey = `visr-analytics:${key}`;
    if (window.sessionStorage.getItem(storageKey) === "1") return;
    window.sessionStorage.setItem(storageKey, "1");
    safeTrack(name, data);
  } catch {
    safeTrack(name, data);
  }
}

function elementLocation(element: Element) {
  const section = element.closest<HTMLElement>("section[id]");
  if (section?.id) return section.id;
  if (element.closest("footer")) return "footer";
  if (element.closest("header")) return "header";
  return "global";
}

function setupHomeSectionTracking() {
  const observed = new Set<Element>();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const target = HOME_SECTIONS.find((item) => document.querySelector(item.selector) === entry.target);
        if (!target) continue;
        trackOnce(`section:${target.section}`, "Section viewed", {
          section: target.section,
          path: "/",
        });
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.32 },
  );

  const attach = () => {
    for (const item of HOME_SECTIONS) {
      const element = document.querySelector(item.selector);
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

function setupInteractionTracking(pathname: string) {
  const handleClick = (event: MouseEvent) => {
    const source = event.target instanceof Element ? event.target.closest("a,button") : null;
    if (!source) return;

    const label = source.textContent?.replace(/\s+/g, " ").trim() ?? "";
    const href = source instanceof HTMLAnchorElement ? source.getAttribute("href") ?? "" : "";
    const location = elementLocation(source);

    if (href === "/order") {
      safeTrack("Support clicked", { action: "track_order", location, path: pathname });
      return;
    }

    if (href.includes("wa.me/")) {
      safeTrack("Support clicked", { action: "whatsapp", location, path: pathname });
      return;
    }

    if (href === "/privacy") {
      safeTrack("Support clicked", { action: "privacy_notice", location, path: pathname });
      return;
    }

    if (href === "/checkout" || href.startsWith("#preorder") || /preorder/i.test(label)) {
      safeTrack("CTA clicked", { action: "preorder", location, path: pathname });
    }

    if (pathname === "/" && /frequently asked questions|^open$|^close$/i.test(label)) {
      safeTrack("CTA clicked", {
        action: source.getAttribute("aria-expanded") === "true" ? "faq_close" : "faq_open",
        location: "faq",
        path: pathname,
      });
    }

    if (pathname === "/checkout") {
      if (label === "Continue to Information") {
        safeTrack("Checkout step", { step: "information", path: pathname });
      } else if (/^Pay\s+Rp/i.test(label) && /Midtrans/i.test(label)) {
        safeTrack("Checkout step", { step: "payment", path: pathname });
      }
    }
  };

  const handleSubmit = (event: SubmitEvent) => {
    if (pathname !== "/order") return;
    const form = event.target instanceof HTMLFormElement ? event.target : null;
    if (!form) return;
    safeTrack("Order tracking submitted", { path: pathname });
  };

  document.addEventListener("click", handleClick);
  document.addEventListener("submit", handleSubmit);
  return () => {
    document.removeEventListener("click", handleClick);
    document.removeEventListener("submit", handleSubmit);
  };
}

function VisrBehaviorTracking() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith("/visr-control")) return;

    if (pathname === "/checkout") {
      trackOnce("checkout:view", "Checkout viewed", { path: pathname });
    } else if (pathname === "/order") {
      trackOnce("order:view", "Order tracking viewed", { path: pathname });
    }

    const cleanupSections = pathname === "/" ? setupHomeSectionTracking() : undefined;
    const cleanupInteractions = setupInteractionTracking(pathname);

    return () => {
      cleanupSections?.();
      cleanupInteractions();
    };
  }, [pathname]);

  return null;
}

export function ConsentAnalytics() {
  return (
    <>
      <Analytics
        mode="production"
        beforeSend={(event) => {
          const pathname = new URL(event.url, window.location.origin).pathname;
          return pathname.startsWith("/visr-control") ? null : event;
        }}
      />
      <SpeedInsights />
      <VisrBehaviorTracking />
    </>
  );
}
