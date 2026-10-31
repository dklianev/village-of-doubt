"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuthSession, type AuthSessionView } from "@/lib/use-auth-session";
import { safeLocalStorage } from "@/lib/safe-storage";
import { shouldMountFeedback } from "@/components/feedback/route-policy";
import { OptionalFeatureBoundary as WidgetBoundary } from "./OptionalFeatureBoundary";

const CookieBanner = dynamic(() => import("@/components/CookieBanner").then((mod) => mod.CookieBanner), {
  ssr: false,
});

const FeedbackWidget = dynamic(() => import("@/components/feedback/FeedbackWidget").then((mod) => mod.FeedbackWidget), {
  ssr: false,
});

const WelcomeModal = dynamic(() => import("@/components/onboarding/WelcomeModal").then((mod) => mod.WelcomeModal), {
  ssr: false,
});

const COOKIE_STORAGE_KEY = "cookie-consent";
const WELCOME_STORAGE_KEY = "welcome-modal-shown";
const TUTORIAL_STORAGE_KEY = "tutorial-completed";

type WidgetMountState = {
  cookie: boolean;
  feedback: boolean;
  welcome: boolean;
};

export function NonCriticalWidgets({ initialSession, cookieFallback }: { initialSession: AuthSessionView | null; cookieFallback?: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const reveal = () => setReady(true);
    const schedule = () => {
      if (typeof window.requestIdleCallback === "function") {
        const idleId = window.requestIdleCallback(reveal, { timeout: 1_500 });
        return () => window.cancelIdleCallback(idleId);
      }
      const timeoutId = window.setTimeout(reveal, 1_500);
      return () => window.clearTimeout(timeoutId);
    };

    if (document.readyState === "complete") {
      return schedule();
    }

    let cancelScheduled: (() => void) | undefined;
    const onLoad = () => {
      cancelScheduled = schedule();
    };
    window.addEventListener("load", onLoad, { once: true });

    return () => {
      window.removeEventListener("load", onLoad);
      cancelScheduled?.();
    };
  }, []);

  return ready ? <DeferredWidgets initialSession={initialSession} cookieFallback={cookieFallback} /> : null;
}

function DeferredWidgets({
  initialSession,
  cookieFallback,
}: {
  initialSession: AuthSessionView | null;
  cookieFallback?: ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useAuthSession(initialSession);
  const mount: WidgetMountState = {
    cookie: !safeLocalStorage.getItem(COOKIE_STORAGE_KEY),
    feedback: shouldMountFeedback(pathname, Boolean(session?.user?.id)),
    welcome:
      pathname !== "/tutorial" &&
      Boolean(session?.user?.id) &&
      !safeLocalStorage.getItem(WELCOME_STORAGE_KEY) &&
      !safeLocalStorage.getItem(TUTORIAL_STORAGE_KEY),
  };

  return (
    <>
      {mount.cookie ? <WidgetBoundary resetKey={pathname} fallback={cookieFallback}><CookieBanner /></WidgetBoundary> : null}
      {mount.welcome ? <WidgetBoundary resetKey={pathname}><WelcomeModal displayName={session?.user?.name ?? "приятел"} /></WidgetBoundary> : null}
      {mount.feedback && session ? <WidgetBoundary resetKey={pathname}><FeedbackWidget session={session} /></WidgetBoundary> : null}
    </>
  );
}
