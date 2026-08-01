"use client";

import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import {
  TRACKING_CONSENT_EVENT,
  TRACKING_CONSENT_STORAGE_KEY,
  isTrackingConsent,
  type TrackingConsent,
} from "@/lib/privacy/consent";

function storedConsent(): TrackingConsent | null {
  try {
    const value = window.localStorage.getItem(TRACKING_CONSENT_STORAGE_KEY);
    return isTrackingConsent(value) ? value : null;
  } catch {
    return null;
  }
}

export function ConsentAnalytics() {
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

  if (consent !== "granted") return null;
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
