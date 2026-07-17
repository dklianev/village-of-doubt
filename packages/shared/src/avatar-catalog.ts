export const AVATAR_IDS = [
  "portrait-m01",
  "portrait-m02",
  "portrait-m03",
  "portrait-m04",
  "portrait-m05",
  "portrait-m06",
  "portrait-m07",
  "portrait-f01",
  "portrait-f02",
  "portrait-f03",
  "portrait-f04",
  "portrait-f05",
  "portrait-f06",
  "portrait-f07",
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

export const DEFAULT_AVATAR_ID: AvatarId = "portrait-m01";

const AVATAR_ID_SET = new Set<string>(AVATAR_IDS);

export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === "string" && AVATAR_ID_SET.has(value);
}

export function normalizeAvatarId(value: unknown): AvatarId {
  return isAvatarId(value) ? value : DEFAULT_AVATAR_ID;
}

export function avatarIdForSeed(seed: string): AvatarId {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return AVATAR_IDS[(hash >>> 0) % AVATAR_IDS.length] ?? DEFAULT_AVATAR_ID;
}
