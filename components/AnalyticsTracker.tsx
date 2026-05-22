"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackEvent, trackPageView, updateSessionHeartbeat } from "@/lib/analytics";

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const path = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    trackPageView(path);
  }, [pathname, searchParams]);

  useEffect(() => {
    trackEvent({ event_type: "session_start" });

    function heartbeat() {
      if (document.visibilityState !== "visible") return;
      trackEvent({ event_type: "session_active" });
    }

    updateSessionHeartbeat();
    const interval = window.setInterval(heartbeat, 30000);
    document.addEventListener("visibilitychange", heartbeat);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", heartbeat);
    };
  }, []);

  return null;
}
