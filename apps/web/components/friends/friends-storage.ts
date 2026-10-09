import { safeLocalStorage } from "@/lib/safe-storage";

export const FRIENDS_STORAGE_KEY = "werewolf-mafia-friends-v1";
export const FRIENDS_BACKUP_KEY = `${FRIENDS_STORAGE_KEY}-recovery`;
export const MAX_FRIENDS = 100;
export const MAX_FRIEND_NAME = 60;
export const MAX_FRIEND_NOTE = 240;
const MAX_STORAGE_LENGTH = 128_000;

export interface FriendItem { id: string; name: string; note: string }
export type FriendsSnapshot = {
  friends: FriendItem[];
  raw: string | null;
  needsRecovery: boolean;
  unavailable: boolean;
};

export function friendNameKey(name: string) {
  return name.trim().normalize("NFC").toLocaleLowerCase("bg-BG");
}

export function parseFriends(raw: string | null): Pick<FriendsSnapshot, "friends" | "needsRecovery"> {
  const friends: FriendItem[] = [];
  if (raw === null) return { friends, needsRecovery: false };
  if (raw.length > MAX_STORAGE_LENGTH) return { friends, needsRecovery: true };
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return { friends, needsRecovery: true }; }
  if (!Array.isArray(value)) return { friends, needsRecovery: true };
  const ids = new Set<string>();
  const names = new Set<string>();
  let needsRecovery = value.length > MAX_FRIENDS;
  for (const item of value) {
    if (friends.length === MAX_FRIENDS) break;
    if (!item || typeof item !== "object" || typeof item.id !== "string"
      || !item.id.trim() || item.id.length > 128 || typeof item.name !== "string"
      || item.name.trim().length < 2 || item.name.length > MAX_FRIEND_NAME
      || typeof item.note !== "string" || item.note.length > MAX_FRIEND_NOTE) {
      needsRecovery = true;
      continue;
    }
    const key = friendNameKey(item.name);
    if (ids.has(item.id) || names.has(key)) { needsRecovery = true; continue; }
    ids.add(item.id);
    names.add(key);
    friends.push({ id: item.id, name: item.name, note: item.note });
  }
  return { friends, needsRecovery };
}

export function readFriends(): FriendsSnapshot {
  try {
    const raw = window.localStorage.getItem(FRIENDS_STORAGE_KEY);
    return { ...parseFriends(raw), raw, unavailable: false };
  } catch {
    return { friends: [], raw: null, needsRecovery: false, unavailable: true };
  }
}

export function writeFriends(friends: FriendItem[], snapshot: FriendsSnapshot, recover = false) {
  const current = readFriends();
  if (current.unavailable) return "unavailable";
  if (current.raw !== snapshot.raw) return "changed";
  if (snapshot.needsRecovery) {
    if (!recover || current.raw === null) return "recovery";
    // One recovery slot preserves the original bytes without replacing an older backup.
    try {
      const backup = window.localStorage.getItem(FRIENDS_BACKUP_KEY);
      if (backup !== null && backup !== current.raw) return "backup";
      if (backup === null && !safeLocalStorage.setItem(FRIENDS_BACKUP_KEY, current.raw)) return "unavailable";
    } catch { return "unavailable"; }
  }
  const validated = parseFriends(JSON.stringify(friends));
  if (validated.needsRecovery || !safeLocalStorage.setJson(FRIENDS_STORAGE_KEY, validated.friends)) return "unavailable";
  return "saved";
}
