"use client";

import type { NavigationMetric } from "./navigation-telemetry";

type SentryClientRuntime = typeof import("./sentry-client-runtime");

let clientPromise: Promise<SentryClientRuntime | null> | null = null;

function loadSentryClient(): Promise<SentryClientRuntime | null> {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) {
    return Promise.resolve(null);
  }

  clientPromise ??= import("./sentry-client-runtime")
    .then((client) => {
      client.initBrowserMonitoring({
        dsn,
        environment: process.env.NODE_ENV,
        release: process.env.NEXT_PUBLIC_RELEASE_VERSION,
      });
      return client;
    })
    .catch((error: unknown) => {
      console.error("Failed to initialize browser error monitoring.", error);
      return null;
    });

  return clientPromise;
}

export function startClientMonitoring(): void {
  if (typeof window === "undefined" || !process.env.NEXT_PUBLIC_SENTRY_DSN?.trim()) {
    return;
  }

  const idleWindow = window as Window & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  };
  if (typeof idleWindow.requestIdleCallback === "function") {
    idleWindow.requestIdleCallback(() => void loadSentryClient(), { timeout: 2_000 });
    return;
  }

  globalThis.setTimeout(() => void loadSentryClient(), 0);
}

export function captureClientException(error: unknown): void {
  void loadSentryClient().then((client) => client?.captureBrowserException(error));
}

export function captureNavigationMetric(metric: NavigationMetric): void {
  void loadSentryClient().then((client) => client?.captureBrowserNavigationMetric(metric));
}
