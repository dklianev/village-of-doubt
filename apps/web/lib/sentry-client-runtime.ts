"use client";

import {
  BrowserClient,
  breadcrumbsIntegration,
  captureException,
  dedupeIntegration,
  defaultStackParser,
  getCurrentScope,
  globalHandlersIntegration,
  linkedErrorsIntegration,
  makeFetchTransport,
  metrics,
} from "@sentry/browser";
import type { NavigationMetric } from "./navigation-telemetry";
import { sanitizeMonitoringBreadcrumb, sanitizeMonitoringEvent, sanitizeMonitoringSpan } from "./sentry-sanitization";

type BrowserMonitoringOptions = {
  dsn: string;
  environment: string | undefined;
  release: string | undefined;
};

let initialized = false;

export function initBrowserMonitoring(options: BrowserMonitoringOptions): void {
  if (initialized) {
    return;
  }

  const client = new BrowserClient({
    ...options,
    sendDefaultPii: false,
    beforeSend: sanitizeMonitoringEvent,
    beforeSendTransaction: sanitizeMonitoringEvent,
    beforeSendSpan: sanitizeMonitoringSpan,
    beforeBreadcrumb: sanitizeMonitoringBreadcrumb,
    transport: makeFetchTransport,
    stackParser: defaultStackParser,
    integrations: [
      // DOM breadcrumbs serialize class names and aria-labels, which name roles and players.
      breadcrumbsIntegration({ dom: false }),
      globalHandlersIntegration(),
      linkedErrorsIntegration(),
      dedupeIntegration(),
    ],
  });

  getCurrentScope().setClient(client);
  client.init();
  initialized = true;
}

export function captureBrowserException(error: unknown): void {
  captureException(error);
}

export function captureBrowserNavigationMetric(metric: NavigationMetric): void {
  metrics.distribution("ui.navigation.duration", metric.durationMs, {
    unit: "millisecond",
    attributes: {
      from_route: metric.fromRoute,
      navigation_type: metric.navigationType,
      prefetch_intent: metric.prefetchIntent ?? "programmatic",
      target_route: metric.targetRoute,
    },
  });
}
