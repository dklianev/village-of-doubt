import type { CSSProperties } from "react";
import { ROLE_DEFINITIONS, getRoleAssetKey, type GameFamily, type RoleCode } from "@werewolf/shared";

function visualFamilyForRole(family: GameFamily, role: RoleCode): GameFamily {
  const availableFamilies = ROLE_DEFINITIONS[role].availableInFamilies as readonly GameFamily[];
  return availableFamilies.includes(family) ? family : availableFamilies[0] ?? family;
}

export function roleArtPath(family: GameFamily, role: RoleCode, extension: "png" | "webp" = "webp") {
  const visualFamily = visualFamilyForRole(family, role);
  const prefix = visualFamily === "mafia" ? "/game-art/mafia" : "/game-art";
  return `${prefix}/role-${visualAssetKey(visualFamily, role)}.${extension}`;
}

export function roleThumbPath(family: GameFamily, role: RoleCode) {
  const visualFamily = visualFamilyForRole(family, role);
  const prefix = visualFamily === "mafia" ? "/game-art/thumbs/mafia" : "/game-art/thumbs";
  return `${prefix}/role-${visualAssetKey(visualFamily, role)}.webp`;
}

export function roleThumbStyle(family: GameFamily, role: RoleCode) {
  return { "--role-art": `url("${roleThumbPath(family, role)}")` } as CSSProperties;
}

function visualAssetKey(family: GameFamily, role: RoleCode) {
  return family === "werewolves" && role === "jester" ? "jester-werewolf" : getRoleAssetKey(role);
}
