"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { initSiteAnalytics, trackPageView } from "@/lib/siteAnalytics";

export default function SiteAnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => initSiteAnalytics(), []);

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    trackPageView(pathname);
  }, [pathname, searchParams]);

  return null;
}
