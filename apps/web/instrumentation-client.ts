export function onRouterTransitionStart() {
  // Client-side Sentry is intentionally disabled to keep the public JS budget tight.
  // Server and edge instrumentation still capture request/runtime failures.
}
