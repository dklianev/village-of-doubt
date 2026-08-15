import type { RouterTransitionStartEvent, RouterTransitionType } from "next";
import { beginNavigationTransition } from "@/lib/navigation-telemetry";
import { startClientMonitoring } from "@/lib/sentry-client";

performance.mark("werewolf-web:client-start");
startClientMonitoring();

export function onRouterTransitionStart(
  url: string,
  navigationType: RouterTransitionType,
  event: RouterTransitionStartEvent,
) {
  beginNavigationTransition({
    id: event.id,
    targetUrl: url,
    navigationType,
    fromRoutes: event.fromRoutes,
    prefetchIntent: event.prefetchIntent,
    startedAt: event.timestamp,
  });
}
