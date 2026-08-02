"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { track } from "@vercel/analytics";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const HOME_SECTIONS = [
  { selector: "#opening", section: "opening" },
  { selector: "#preorder", section: "preorder" },
  { selector: "#link-system", section: "visr_link" },
  { selector: "#carry", section: "visr_carry" },
  { selector: "#halo", section: "halo_collection" },
  { selector: "#preorder-details", section: "preorder_details" },
  { selector: "#configure", section: "final_cta" },
  { selector: "#faq", section: "faq" },
] as const;

type EventData = Record<string, string | number | boolean>;

function safeTrack(name: string, data?: EventData) {
  try {
    track(name, data);
  } catch {
    // Analytics must never interrupt the shopping experience.
  }
}

function trackOnce(key: string, name: string, data?: EventData) {
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

function viewportBucket() {
  const width = window.innerWidth;
  if (width <= 374) return "small_mobile";
  if (width <= 430) return "mobile";
  if (width <= 767) return "large_mobile";
  if (width <= 1024) return "tablet";
  return "desktop";
}

function trafficSourceType() {
  const referrer = document.referrer.trim().toLowerCase();
  if (!referrer) return "direct";
  if (referrer.includes(window.location.hostname.toLowerCase())) return "internal";
  if (referrer.includes("instagram")) return "instagram";
  if (referrer.includes("facebook") || referrer.includes("fb.com")) return "facebook";
  if (referrer.includes("google")) return "google";
  if (referrer.includes("t.co") || referrer.includes("twitter") || referrer.includes("x.com")) return "x_twitter";
  return "other_referral";
}

function wibContext() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    hourCycle: "h23",
    weekday: "long",
  }).formatToParts(new Date());
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const weekday = parts.find((part) => part.type === "weekday")?.value.toLowerCase() ?? "unknown";
  return { hourWib: `wib_${hour}`, weekdayWib: weekday };
}

function scrollBucket(percent: number) {
  if (percent < 25) return "scroll_0_24";
  if (percent < 50) return "scroll_25_49";
  if (percent < 75) return "scroll_50_74";
  if (percent < 90) return "scroll_75_89";
  return "scroll_90_100";
}

function engagedTimeBucket(seconds: number) {
  if (seconds < 15) return "time_under_15s";
  if (seconds < 45) return "time_15_44s";
  if (seconds < 90) return "time_45_89s";
  if (seconds < 180) return "time_90_179s";
  return "time_180s_plus";
}

function sectionsSeenBucket(count: number) {
  if (count <= 1) return "sections_one";
  if (count <= 3) return "sections_two_three";
  if (count <= 5) return "sections_four_five";
  return "sections_six_plus";
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

function setupSessionSummary(pathname: string) {
  const viewport = viewportBucket();
  const orientation = window.matchMedia("(orientation: landscape)").matches ? "landscape" : "portrait";
  const wib = wibContext();
  let activeSeconds = 0;
  let maxScrollPercent = 0;
  let lastSection = pathname === "/" ? "opening" : pathname.replace(/^\//, "") || "homepage";
  let sent = false;
  const sectionsSeen = new Set<string>();
  const observedSections = new Set<Element>();

  trackOnce("session:start", "Session started", {
    landingPath: pathname,
    sourceType: trafficSourceType(),
    viewport,
    orientation,
    hourWib: wib.hourWib,
    weekdayWib: wib.weekdayWib,
  });

  const updateScroll = () => {
    const available = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const percent = available === 0 ? 100 : Math.min(100, Math.round((window.scrollY / available) * 100));
    maxScrollPercent = Math.max(maxScrollPercent, percent);
  };

  const sectionObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
      if (!(visible?.target instanceof HTMLElement)) return;
      const section = visible.target.id || "unknown";
      lastSection = section;
      sectionsSeen.add(section);
    },
    { threshold: [0.25, 0.5, 0.7] },
  );

  const attachSections = () => {
    for (const section of document.querySelectorAll("section[id]")) {
      if (observedSections.has(section)) continue;
      observedSections.add(section);
      sectionObserver.observe(section);
    }
  };

  updateScroll();
  attachSections();
  window.addEventListener("scroll", updateScroll, { passive: true });
  window.addEventListener("resize", updateScroll, { passive: true });

  const mutationObserver = new MutationObserver(attachSections);
  mutationObserver.observe(document.body, { childList: true, subtree: true });

  const activeTimer = window.setInterval(() => {
    if (document.visibilityState === "visible") activeSeconds += 1;
  }, 1000);

  const sendSummary = () => {
    if (sent) return;
    sent = true;
    updateScroll();
    safeTrack("Session summary", {
      path: pathname,
      maxScroll: scrollBucket(maxScrollPercent),
      engagedTime: engagedTimeBucket(activeSeconds),
      lastSection,
      sectionsSeen: sectionsSeenBucket(sectionsSeen.size),
      viewport,
      orientation,
    });
  };

  window.addEventListener("pagehide", sendSummary);

  return () => {
    sendSummary();
    window.clearInterval(activeTimer);
    window.removeEventListener("scroll", updateScroll);
    window.removeEventListener("resize", updateScroll);
    window.removeEventListener("pagehide", sendSummary);
    mutationObserver.disconnect();
    sectionObserver.disconnect();
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
    const cleanupSession = setupSessionSummary(pathname);
    const cleanupInteractions = setupInteractionTracking(pathname);

    return () => {
      cleanupSections?.();
      cleanupSession();
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
