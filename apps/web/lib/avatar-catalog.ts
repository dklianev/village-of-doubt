import type { CSSProperties } from "react";
import {
  AVATAR_IDS,
  avatarIdForSeed,
  normalizeAvatarId,
  type AvatarId,
} from "@werewolf/shared";

export type AvatarGroup = "women" | "men";

export interface AvatarOption {
  id: AvatarId;
  labelBg: string;
  group: AvatarGroup;
}

export const AVATAR_OPTIONS: readonly AvatarOption[] = [
  { id: "portrait-m01", labelBg: "Кръчмарят", group: "men" },
  { id: "portrait-m02", labelBg: "Пазачът", group: "men" },
  { id: "portrait-m03", labelBg: "Писарят", group: "men" },
  { id: "portrait-m04", labelBg: "Джентълменът", group: "men" },
  { id: "portrait-m05", labelBg: "Ловецът", group: "men" },
  { id: "portrait-m06", labelBg: "Музикантът", group: "men" },
  { id: "portrait-m07", labelBg: "Старейшината", group: "men" },
  { id: "portrait-f01", labelBg: "Билкарката", group: "women" },
  { id: "portrait-f02", labelBg: "Пътешественичката", group: "women" },
  { id: "portrait-f03", labelBg: "Лечителката", group: "women" },
  { id: "portrait-f04", labelBg: "Архиварката", group: "women" },
  { id: "portrait-f05", labelBg: "Стопанката", group: "women" },
  { id: "portrait-f06", labelBg: "Следователката", group: "women" },
  { id: "portrait-f07", labelBg: "Скитницата", group: "women" },
] as const;

const OPTION_BY_ID = new Map(AVATAR_OPTIONS.map((option) => [option.id, option]));

if (OPTION_BY_ID.size !== AVATAR_IDS.length) {
  throw new Error("Avatar catalog metadata is incomplete.");
}

export function getAvatarOption(value: unknown): AvatarOption {
  const id = normalizeAvatarId(value);
  return OPTION_BY_ID.get(id) ?? AVATAR_OPTIONS[0]!;
}

export function avatarIdForUser(userId: string, value?: unknown): AvatarId {
  return value === undefined || value === null || value === ""
    ? avatarIdForSeed(userId)
    : normalizeAvatarId(value);
}

export type AvatarPortraitStyle = CSSProperties & {
  "--avatar-image": string;
};

export function avatarPortraitStyle(value: unknown): AvatarPortraitStyle {
  const option = getAvatarOption(value);
  const source = `/game-art/avatars/${option.id}`;

  return {
    "--avatar-image": `url('${source}.webp')`,
  };
}
