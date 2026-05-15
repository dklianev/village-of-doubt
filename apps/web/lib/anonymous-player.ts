// DEPRECATED: anonymous flow беше премахнат за публичното пускане.
// Файлът остава за back-compat на legacy tests. Не го импортирай в нов код.

export const ANONYMOUS_USER_ID_KEY = "anonymous-player-id";
export const ANONYMOUS_DISPLAY_NAME_KEY = "anonymous-display-name";

export function normalizeDisplayName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function validateDisplayNameBg(value: string) {
  const name = normalizeDisplayName(value);
  if (!name) {
    return "Въведи потребителско име.";
  }
  if (name.length < 2) {
    return "Името трябва да е поне 2 символа.";
  }
  if (name.length > 24) {
    return "Името трябва да е до 24 символа.";
  }
  return "";
}

export function getOrCreateAnonymousUserId(): string {
  throw new Error("Anonymous flow е премахнат — използвай Better Auth session.");
}

export function saveAnonymousIdentity(_displayName: string): { userId: string; displayName: string } {
  throw new Error("Anonymous flow е премахнат — използвай Better Auth session.");
}

export function getAnonymousIdentity() {
  return { userId: "", displayName: "" };
}
