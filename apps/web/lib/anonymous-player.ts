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

export function getOrCreateAnonymousUserId() {
  const existing = window.localStorage.getItem(ANONYMOUS_USER_ID_KEY);
  if (existing) {
    return existing;
  }

  const id = crypto.randomUUID();
  window.localStorage.setItem(ANONYMOUS_USER_ID_KEY, id);
  return id;
}

export function saveAnonymousIdentity(displayName: string) {
  const normalized = normalizeDisplayName(displayName);
  const userId = getOrCreateAnonymousUserId();
  window.localStorage.setItem(ANONYMOUS_DISPLAY_NAME_KEY, normalized);
  window.localStorage.setItem("dev-user-id", userId);
  window.localStorage.setItem("dev-display-name", normalized);
  return { userId, displayName: normalized };
}

export function getAnonymousIdentity() {
  const userId = window.localStorage.getItem(ANONYMOUS_USER_ID_KEY) ?? "";
  const displayName = window.localStorage.getItem(ANONYMOUS_DISPLAY_NAME_KEY) ?? "";
  return { userId, displayName };
}
