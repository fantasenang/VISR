"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

export function ConsentAnalytics() {
  return (
    <>
      <Analytics
        beforeSend={(event) => {
          const pathname = new URL(event.url).pathname;
          return pathname.startsWith("/visr-control") ? null : event;
        }}
      />
      <SpeedInsights />
    </>
  );
}
