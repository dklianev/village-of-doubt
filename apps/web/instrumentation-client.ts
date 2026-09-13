import type { RouterTransitionStartEvent, RouterTransitionType } from "next";
import { beginNavigationTransition } from "@/lib/navigation-telemetry";
import { startClientMonitoring } from "@/lib/sentry-client";
import { initializeLobbyNavigationGuard } from "@/hooks/play/lobby-navigation-history";

performance.mark("werewolf-web:client-start");
initializeLobbyNavigationGuard();
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
