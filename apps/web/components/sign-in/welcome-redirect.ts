import { safeLocalStorage } from "@/lib/safe-storage";

export function resolveWelcomeRedirect(redirectTo: string) {
  if (typeof window === "undefined") {
    return redirectTo;
  }

  if (safeLocalStorage.getItem("tutorial-completed")) {
    return redirectTo;
  }

  const params = new URLSearchParams({
    welcome: "1",
    redirect: redirectTo,
  });
  return `/tutorial?${params.toString()}`;
}
