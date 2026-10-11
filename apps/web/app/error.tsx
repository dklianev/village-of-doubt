"use client";

import { RouteErrorState, type RouteErrorBoundaryProps } from "@/components/system/RouteErrorState";

export default function RootError(props: RouteErrorBoundaryProps) {
  return (
    <RouteErrorState
      {...props}
      title="Страницата не се зареди"
      description="Възникна проблем при зареждането на тази страница. Опитай отново или се върни към началото."
    />
  );
}
