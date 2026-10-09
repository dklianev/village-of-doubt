"use client";

import { RouteErrorState, type RouteErrorBoundaryProps } from "@/components/system/RouteErrorState";

export default function AccountError(props: RouteErrorBoundaryProps) {
  return (
    <RouteErrorState
      {...props}
      title="Досието не се отвори"
      description="Не успяхме да заредим профила ти. Опитай отново или се върни към началото."
    />
  );
}
