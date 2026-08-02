"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

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
    </>
  );
}
