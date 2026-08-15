export type NavigationMetric = {
  durationMs: number;
  fromRoute: string;
  navigationType: "push" | "replace" | "traverse";
  prefetchIntent: "full" | "auto" | "none" | null;
  targetRoute: string;
  transitionId: string;
};

type TrackerOptions = {
  maxDurationMs?: number;
  now: () => number;
};

type TransitionStart = {
  id: string;
  targetUrl: string;
  navigationType: NavigationMetric["navigationType"];
  fromRoutes: readonly string[];
  prefetchIntent: NavigationMetric["prefetchIntent"];
  startedAt?: number;
};

type PendingTransition = TransitionStart & {
  startedAt: number;
  targetPathname: string;
};

const DEFAULT_MAX_DURATION_MS = 120_000;
const NAVIGATION_START_MARK = "werewolf-web:navigation-start";
const NAVIGATION_END_MARK = "werewolf-web:navigation-end";
const NAVIGATION_MEASURE = "werewolf-web:navigation";

export function createNavigationTransitionTracker(options: TrackerOptions) {
  const maxDurationMs = options.maxDurationMs ?? DEFAULT_MAX_DURATION_MS;
  let pending: PendingTransition | null = null;

  return {
    start(transition: TransitionStart): void {
      pending = {
        ...transition,
        startedAt: transition.startedAt ?? options.now(),
        targetPathname: pathnameFromUrl(transition.targetUrl),
      };
    },
    complete(pathname: string): NavigationMetric | null {
      const transition = pending;
      pending = null;
      if (!transition) return null;

      const durationMs = options.now() - transition.startedAt;
      if (!Number.isFinite(durationMs) || durationMs < 0 || durationMs > maxDurationMs) {
        return null;
      }

      return {
        durationMs: Math.round(durationMs),
        fromRoute: telemetryRoute(transition.fromRoutes[0] ?? "unknown"),
        navigationType: transition.navigationType,
        prefetchIntent: transition.prefetchIntent,
        targetRoute: telemetryRoute(pathname || transition.targetPathname),
        transitionId: transition.id,
      };
    },
  };
}

export function telemetryRoute(pathname: string): string {
  const normalized = pathnameFromUrl(pathname).replace(/\/$/, "") || "/";
  if (/^\/play\/[^/]+$/.test(normalized)) return "/play/[code]";
  if (/^\/lobby\/[^/]+$/.test(normalized)) return "/lobby/[code]";
  if (/^\/history\/[^/]+\/replay$/.test(normalized)) return "/history/[gameId]/replay";
  return normalized;
}

const browserTracker = createNavigationTransitionTracker({ now: () => Date.now() });

export function beginNavigationTransition(transition: TransitionStart): void {
  browserTracker.start(transition);
  try {
    performance.clearMarks(NAVIGATION_START_MARK);
    performance.clearMarks(NAVIGATION_END_MARK);
    performance.clearMeasures(NAVIGATION_MEASURE);
    performance.mark(NAVIGATION_START_MARK, {
      detail: {
        navigationType: transition.navigationType,
        targetRoute: telemetryRoute(transition.targetUrl),
        transitionId: transition.id,
      },
    });
  } catch {
    // Performance entries are diagnostic only and must never affect navigation.
  }
}

export function completeNavigationTransition(pathname: string): NavigationMetric | null {
  const metric = browserTracker.complete(pathname);
  if (!metric) return null;

  try {
    performance.mark(NAVIGATION_END_MARK);
    performance.measure(NAVIGATION_MEASURE, NAVIGATION_START_MARK, NAVIGATION_END_MARK);
  } catch {
    // Sentry still receives the clock-based metric if the Performance API fails.
  }

  return metric;
}

function pathnameFromUrl(value: string): string {
  if (value === "unknown") return value;
  try {
    return new URL(value, "https://telemetry.invalid").pathname;
  } catch {
    return "/invalid-navigation";
  }
}
