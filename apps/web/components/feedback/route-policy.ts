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

export function shouldMountFeedback(pathname: string) {
  return !FEEDBACK_HIDDEN_ROUTES.has(pathname) && !pathname.startsWith("/api/");
}
