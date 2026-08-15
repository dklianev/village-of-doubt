"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { captureNavigationMetric } from "@/lib/sentry-client";
import { completeNavigationTransition } from "@/lib/navigation-telemetry";

export function NavigationTelemetry() {
  const pathname = usePathname();

  useEffect(() => {
    const metric = completeNavigationTransition(pathname);
    if (metric) captureNavigationMetric(metric);
  }, [pathname]);

  return null;
}
