"use client";

import { RouteErrorState } from "@/components/system/RouteErrorState";

export default function AccountError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteErrorState {...props} title="Досието не се отвори" />;
}
