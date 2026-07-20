"use client";

import { RouteErrorState } from "@/components/system/RouteErrorState";

export default function LeaderboardError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteErrorState {...props} title="Вечерният брой не излезе" />;
}
