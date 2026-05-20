const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (sentryDsn) {
  void import("./sentry.client.config");
}

export function onRouterTransitionStart(...args: unknown[]) {
  if (!sentryDsn) {
    return;
  }

  void import("@sentry/nextjs").then(({ captureRouterTransitionStart }) => {
    const handler = captureRouterTransitionStart as (...handlerArgs: unknown[]) => unknown;
    handler(...args);
  });
}
