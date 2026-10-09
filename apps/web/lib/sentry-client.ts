"use client";

import type { NavigationMetric } from "./navigation-telemetry";

type SentryClientRuntime = typeof import("./sentry-client-runtime");

let clientPromise: Promise<SentryClientRuntime | null> | null = null;
let readyClient: SentryClientRuntime | null = null;
let earlyErrors: unknown[] | null = [];
let cleanupStartup: (() => void) | undefined;

function loadSentryClient(): Promise<SentryClientRuntime | null> {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) {
    return Promise.resolve(null);
  }

  clientPromise ??= import("./sentry-client-runtime")
    .then((client) => {
      cleanupStartup?.();
      cleanupStartup = undefined;
      client.initBrowserMonitoring({
        dsn,
        environment: process.env.NODE_ENV,
        release: process.env.NEXT_PUBLIC_RELEASE_VERSION,
      });
      return client;
    })
    .catch(() => {
      console.error("Failed to initialize browser error monitoring.");
      return null;
    })
    .then((client) => {
      cleanupStartup?.();
      cleanupStartup = undefined;
      readyClient = client;
      const errors = earlyErrors;
      earlyErrors = null;
      for (const error of errors ?? []) client?.captureBrowserException(error);
      return client;
    });

  return clientPromise;
}

export function startClientMonitoring(): void {
  if (typeof window === "undefined" || !process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || cleanupStartup || clientPromise) {
    return;
  }

  let frame = 0;
  let idle = 0;
  let timer = 0;
  const initialize = () => { void loadSentryClient(); };
  const onError = (event: ErrorEvent) => {
    if (event instanceof ErrorEvent) captureClientException(event.error ?? event.message);
  };
  const onRejection = (event: PromiseRejectionEvent) => captureClientException(event.reason);
  const afterPaint = () => {
    window.clearTimeout(timer);
    if (typeof window.requestIdleCallback === "function") {
      idle = window.requestIdleCallback(initialize, { timeout: 2_000 });
    } else {
      timer = window.setTimeout(initialize, 0);
    }
  };
  const afterLoad = () => {
    if (document.visibilityState === "hidden") {
      initialize();
    } else if (typeof window.requestAnimationFrame === "function") {
      frame = window.requestAnimationFrame(() => {
        frame = window.requestAnimationFrame(afterPaint);
      });
      // Frames can stop if the tab becomes hidden while waiting for a paint.
      timer = window.setTimeout(initialize, 2_000);
    } else {
      afterPaint();
    }
  };
  cleanupStartup = () => {
    window.removeEventListener("load", afterLoad);
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    window.cancelAnimationFrame?.(frame);
    window.cancelIdleCallback?.(idle);
    window.clearTimeout(timer);
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  if (document.readyState === "complete") afterLoad();
  else window.addEventListener("load", afterLoad, { once: true });
}

export function captureClientException(error: unknown): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN?.trim()) return;
  if (readyClient) {
    readyClient.captureBrowserException(error);
  } else if (earlyErrors && earlyErrors.length < 20 && !earlyErrors.includes(error)) {
    earlyErrors.push(error);
    void loadSentryClient();
  }
}

export function captureNavigationMetric(metric: NavigationMetric): void {
  void loadSentryClient().then((client) => client?.captureBrowserNavigationMetric(metric));
}
