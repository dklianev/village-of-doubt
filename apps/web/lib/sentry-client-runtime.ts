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
} from "@sentry/browser";

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
    transport: makeFetchTransport,
    stackParser: defaultStackParser,
    integrations: [
      breadcrumbsIntegration(),
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
