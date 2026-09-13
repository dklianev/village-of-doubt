import { safeInternalRedirect } from "@/lib/safe-internal-redirect";

export function verificationCallbackURL(redirectTo: string): string {
  return authRedirectURL("/verify-email", redirectTo);
}

export function authRedirectURL(
  pathname: "/verify-email" | "/forgot-password" | "/reset-password" | "/sign-in",
  redirectTo: string | null | undefined,
): string {
  return `${pathname}?${new URLSearchParams({ redirect: safeInternalRedirect(redirectTo) })}`;
}
