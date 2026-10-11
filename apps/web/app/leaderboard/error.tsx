"use client";

import { RouteErrorState, type RouteErrorBoundaryProps } from "@/components/system/RouteErrorState";

export default function LeaderboardError(props: RouteErrorBoundaryProps) {
  return (
    <RouteErrorState
      {...props}
      title="Вечерният брой не се зареди"
      description="Не успяхме да заредим класацията. Опитай отново или се върни към началото."
    />
  );
}
