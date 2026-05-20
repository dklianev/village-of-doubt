export function resolveWelcomeRedirect(redirectTo: string) {
  if (typeof window === "undefined") {
    return redirectTo;
  }

  try {
    return window.localStorage.getItem("tutorial-completed") ? redirectTo : "/tutorial?welcome=1";
  } catch {
    return redirectTo;
  }
}
