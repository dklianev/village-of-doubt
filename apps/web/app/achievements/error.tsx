"use client";

import { RouteErrorState, type RouteErrorBoundaryProps } from "@/components/system/RouteErrorState";

export default function AchievementsError(props: RouteErrorBoundaryProps) {
  return (
    <RouteErrorState
      {...props}
      title="Легендите не се заредиха"
      description="Не успяхме да заредим постиженията ти. Опитай отново или се върни към началото."
    />
  );
}
