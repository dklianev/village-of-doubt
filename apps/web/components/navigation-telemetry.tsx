"use client";

import { useEffect } from "react";
import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { captureNavigationMetric } from "@/lib/sentry-client";
import { completeNavigationTransition } from "@/lib/navigation-telemetry";
import styles from "./LinkPendingHint.module.css";

export function NavigationTelemetry() {
  const pathname = usePathname();

  useEffect(() => {
    const metric = completeNavigationTransition(pathname);
    if (metric) captureNavigationMetric(metric);
  }, [pathname]);

  return null;
}

export function LinkPendingHint() {
  const { pending } = useLinkStatus();

  return (
    <span
      className={styles.hint}
      data-link-pending
      data-visible={pending ? "true" : "false"}
      aria-hidden="true"
    />
  );
}
