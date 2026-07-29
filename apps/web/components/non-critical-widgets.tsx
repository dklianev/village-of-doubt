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

const EMPTY_WIDGETS: WidgetMountState = {
  cookie: false,
  feedback: false,
  welcome: false,
};

export function NonCriticalWidgets({ initialSession }: { initialSession: AuthSessionView | null }) {
  const pathname = usePathname();
  const { data: session } = useAuthSession(initialSession);
  const [mount, setMount] = useState<WidgetMountState>(EMPTY_WIDGETS);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setMount({
        cookie: !safeLocalStorage.getItem(COOKIE_STORAGE_KEY),
        feedback: shouldMountFeedback(pathname, Boolean(session?.user?.id)),
        welcome:
          Boolean(session?.user?.id) &&
          !safeLocalStorage.getItem(WELCOME_STORAGE_KEY) &&
          !safeLocalStorage.getItem(TUTORIAL_STORAGE_KEY),
      });
    }, 0);

    return () => window.clearTimeout(id);
  }, [pathname, session?.user?.id]);

  return (
    <>
      {mount.cookie ? <CookieBanner /> : null}
      {mount.welcome ? <WelcomeModal displayName={session?.user?.name ?? "приятел"} /> : null}
      {mount.feedback ? <FeedbackWidget /> : null}
    </>
  );
}
