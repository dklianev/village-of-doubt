"use client";

import dynamic from "next/dynamic";

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

export function NonCriticalWidgets() {
  return (
    <>
      <CookieBanner />
      <WelcomeModal />
      <FeedbackWidget />
    </>
  );
}
