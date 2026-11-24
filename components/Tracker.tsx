"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/* First-party, cookie-less page-event beacon. Sends no identifiers. */
export default function Tracker({ type = "page_view", productId, categoryId, guideId, search, demo }: { type?: string; productId?: string; categoryId?: string; guideId?: string; search?: string; demo?: boolean }) {
  const path = usePathname();
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const body = JSON.stringify({
        type, path, productId, categoryId, guideId, search, demo: !!demo,
        ref: document.referrer ? new URL(document.referrer).hostname : null,
        utm_source: sp.get("utm_source"), utm_medium: sp.get("utm_medium"), utm_campaign: sp.get("utm_campaign"),
      });
      if (navigator.sendBeacon) navigator.sendBeacon("/api/event", new Blob([body], { type: "application/json" }));
      else fetch("/api/event", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
    } catch {}
  }, [type, path, productId, categoryId, guideId, search, demo]);
  return null;
}
