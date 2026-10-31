export const RECENT_ROOMS_STORAGE_KEY = "werewolf-mafia:recent-rooms";
export const ROOM_RECONNECT_STORAGE_PREFIX = "room-reconnect";

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
