"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuthSession, type AuthSessionView } from "@/lib/use-auth-session";
import { safeLocalStorage } from "@/lib/safe-storage";
import { shouldMountFeedback } from "@/components/feedback/route-policy";

const CookieBanner = dynamic(() => import("@/components/CookieBanner").then((mod) => mod.CookieBanner), {
  loading: () => null,
  ssr: false,
});

const FeedbackWidget = dynamic(() => import("@/components/feedback/FeedbackWidget").then((mod) => mod.FeedbackWidget), {
  loading: () => null,
  ssr: false,
});

const WelcomeModal = dynamic(() => import("@/components/onboarding/WelcomeModal").then((mod) => mod.WelcomeModal), {
  loading: () => null,
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

export function NonCriticalWidgets({ initialSession }: { initialSession: AuthSessionView | null }) {
  const pathname = usePathname();
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

  return ready ? <DeferredWidgets initialSession={initialSession} pathname={pathname} /> : null;
}

function DeferredWidgets({
  initialSession,
  pathname,
}: {
  initialSession: AuthSessionView | null;
  pathname: string;
}) {
  const { data: session } = useAuthSession(initialSession);
  const mount: WidgetMountState = {
    cookie: !safeLocalStorage.getItem(COOKIE_STORAGE_KEY),
    feedback: shouldMountFeedback(pathname, Boolean(session?.user?.id)),
    welcome:
      Boolean(session?.user?.id) &&
      !safeLocalStorage.getItem(WELCOME_STORAGE_KEY) &&
      !safeLocalStorage.getItem(TUTORIAL_STORAGE_KEY),
  };

  return (
    <>
      {mount.cookie ? <CookieBanner /> : null}
      {mount.welcome ? <WelcomeModal displayName={session?.user?.name ?? "приятел"} /> : null}
      {mount.feedback && session ? <FeedbackWidget session={session} /> : null}
    </>
  );
}
