"use client";

import { Analytics } from "@vercel/analytics/next";

export function SiteAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        const path = new URL(event.url).pathname;
        return path.startsWith("/internal") ? null : event;
      }}
    />
  );
}
