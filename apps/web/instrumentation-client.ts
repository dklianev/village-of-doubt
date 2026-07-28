import { startClientMonitoring } from "@/lib/sentry-client";

performance.mark("werewolf-web:client-start");
startClientMonitoring();

export function onRouterTransitionStart(url: string, navigationType: "push" | "replace" | "traverse") {
  performance.mark("werewolf-web:navigation-start", {
    detail: { navigationType, url: new URL(url, window.location.origin).pathname },
  });
}
