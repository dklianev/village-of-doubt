import { tutorialMode, tutorialWorld } from "./tutorial-scenario";

// Presentation only: callers keep the already-validated destination unchanged.
export function tutorialDestination(href: string) {
  const { pathname } = new URL(href, "https://example.invalid");
  const invitation = /^\/(?:werewolf\/|mafia\/)?(?:join|lobby|play)(?:\/|$)/.test(pathname);
  const create = /^\/(?:werewolf|mafia)\/create\/?$/.test(pathname);
  const name = create ? tutorialWorld(tutorialMode(null, href)).name : null;
  return { invitation, name };
}
