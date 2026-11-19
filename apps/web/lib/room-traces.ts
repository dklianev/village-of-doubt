import { normalizeRoomCode } from "@werewolf/shared";

export const RECENT_ROOMS_STORAGE_KEY = "werewolf-mafia:recent-rooms";
export const ROOM_RECONNECT_STORAGE_PREFIX = "room-reconnect";
const ROOM_CREATION_STORAGE_PREFIX = "room-create";

// Kept in memory as well, so the create flow still works where sessionStorage is blocked.
const pendingRoomCreations = new Set<string>();

function roomCreationKey(code: string) {
  return `${ROOM_CREATION_STORAGE_PREFIX}:${normalizeRoomCode(code)}`;
}

/** Lets this tab open the room on its next join; every other join must find a room that already exists. */
export function markRoomCreation(code: string) {
  const key = roomCreationKey(code);
  pendingRoomCreations.add(key);
  try {
    window.sessionStorage.setItem(key, "1");
  } catch {
    // Storage can be unavailable in hardened browser modes.
  }
}

export function isRoomCreationPending(code: string) {
  const key = roomCreationKey(code);
  if (pendingRoomCreations.has(key)) return true;
  try {
    return window.sessionStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

export function settleRoomCreation(code: string) {
  const key = roomCreationKey(code);
  pendingRoomCreations.delete(key);
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Storage can be unavailable in hardened browser modes.
  }
}

/** Removes room codes and seat reconnect tokens that belong to the account leaving this browser. */
export function forgetRoomTraces() {
  try {
    window.localStorage.removeItem(RECENT_ROOMS_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in hardened browser modes.
  }
  try {
    const session = window.sessionStorage;
    const reconnectKeys = Array.from({ length: session.length }, (_, index) => session.key(index))
      .filter((key): key is string => key?.startsWith(`${ROOM_RECONNECT_STORAGE_PREFIX}:`) ?? false);
    for (const key of reconnectKeys) session.removeItem(key);
  } catch {
    // Storage can be unavailable in hardened browser modes.
  }
}
