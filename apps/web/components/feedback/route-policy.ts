const FEEDBACK_HIDDEN_ROUTES = new Set([
  "/",
  "/werewolf",
  "/mafia",
  "/werewolf/rules",
  "/mafia/rules",
  "/werewolf/roles",
  "/mafia/roles",
  "/roles",
  "/create",
  "/lobby",
  "/werewolf/create",
  "/mafia/create",
  "/sign-in",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
]);

const FEEDBACK_HIDDEN_PREFIXES = ["/play/"];
const FEEDBACK_AUTH_ROUTES = new Set(["/account", "/achievements", "/friends"]);
const FEEDBACK_AUTH_PREFIXES = ["/history/"];

export function shouldMountFeedback(pathname: string, authenticated = true) {
  if (
    !authenticated
    && (
      FEEDBACK_AUTH_ROUTES.has(pathname)
      || FEEDBACK_AUTH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
    )
  ) {
    return false;
  }

  return !FEEDBACK_HIDDEN_ROUTES.has(pathname)
    && !FEEDBACK_HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))
    && !pathname.startsWith("/api/");
}
