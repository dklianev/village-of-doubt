"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { AuthSessionView } from "@/lib/use-auth-session";

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

const FEEDBACK_HIDDEN_ROUTES = new Set([
  "/",
  "/werewolf",
  "/mafia",
  "/werewolf/rules",
  "/mafia/rules",
  "/werewolf/roles",
  "/mafia/roles",
  "/roles",
  "/create",
  "/lobby",
  "/werewolf/create",
  "/mafia/create",
  "/sign-in",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/privacy",
  "/terms",
  "/faq",
  "/status",
  "/report",
]);

type WidgetMountState = {
  cookie: boolean;
  feedback: boolean;
  welcome: boolean;
};

const EMPTY_WIDGETS: WidgetMountState = {
  cookie: false,
  feedback: false,
  welcome: false,
};

export function NonCriticalWidgets({ initialSession }: { initialSession: AuthSessionView | null }) {
  const pathname = usePathname();
  const [mount, setMount] = useState<WidgetMountState>(EMPTY_WIDGETS);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setMount({
        cookie: !window.localStorage.getItem(COOKIE_STORAGE_KEY),
        feedback: shouldMountFeedback(pathname),
        welcome:
          Boolean(initialSession?.user?.id) &&
          !window.localStorage.getItem(WELCOME_STORAGE_KEY) &&
          !window.localStorage.getItem(TUTORIAL_STORAGE_KEY),
      });
    }, 0);

    return () => window.clearTimeout(id);
  }, [initialSession?.user?.id, pathname]);

  return (
    <>
      {mount.cookie ? <CookieBanner /> : null}
      {mount.welcome ? <WelcomeModal /> : null}
      {mount.feedback ? <FeedbackWidget /> : null}
    </>
  );
}

function shouldMountFeedback(pathname: string) {
  if (FEEDBACK_HIDDEN_ROUTES.has(pathname)) {
    return false;
  }
  if (pathname.startsWith("/api/")) {
    return false;
  }
  return true;
}
