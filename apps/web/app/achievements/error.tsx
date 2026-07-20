"use client";

import { RouteErrorState } from "@/components/system/RouteErrorState";

export default function AchievementsError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteErrorState {...props} title="Залата на легендите остана затворена" />;
}
