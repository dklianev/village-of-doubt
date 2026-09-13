import { safeLocalStorage } from "@/lib/safe-storage";
import { safeInternalRedirect } from "@/lib/safe-internal-redirect";

export function resolveWelcomeRedirect(redirectTo: string) {
  redirectTo = safeInternalRedirect(redirectTo);
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
