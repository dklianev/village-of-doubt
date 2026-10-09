import type { CSSProperties } from "react";
import { ROLE_DEFINITIONS, getRoleAssetKey, type GameFamily, type RoleCode } from "@werewolf/shared";

export { coverImageSizes, type CoverImageSlot } from "./image-sizes";

function visualFamilyForRole(family: GameFamily, role: RoleCode): GameFamily {
  const availableFamilies = ROLE_DEFINITIONS[role].availableInFamilies as readonly GameFamily[];
  return availableFamilies.includes(family) ? family : availableFamilies[0] ?? family;
}

export function roleArtPath(family: GameFamily, role: RoleCode, extension: "png" | "webp" = "webp") {
  const visualFamily = visualFamilyForRole(family, role);
  const prefix = visualFamily === "mafia" ? "/game-art/mafia" : "/game-art";
  return `${prefix}/role-${visualAssetKey(visualFamily, role)}.${extension}${extension === "webp" ? roleArtRevision(visualFamily, role) : ""}`;
}

const squareRoles: Record<GameFamily, readonly RoleCode[]> = {
  werewolves: [
    "red_riding_hood", "oracle", "cook", "blacksmith", "insomniac",
    "vampire_hunter", "investigator", "drunk", "stray_cat", "guard_dog",
  ],
  mafia: [
    "doctor", "detective", "bodyguard", "vigilante", "medium", "roleblocker",
    "lawyer", "maniac", "jester", "mafia_mayor", "lovers",
  ],
};

export function roleArtSource(family: GameFamily, role: RoleCode) {
  const visualFamily = visualFamilyForRole(family, role);
  const dimensions = squareRoles[visualFamily].includes(role)
      ? { width: 1100, height: 1100 }
      : { width: 1024, height: 1536 };
  return { src: roleArtPath(family, role), ...dimensions };
}

export function roleThumbPath(family: GameFamily, role: RoleCode) {
  const visualFamily = visualFamilyForRole(family, role);
  const prefix = visualFamily === "mafia" ? "/game-art/thumbs/mafia" : "/game-art/thumbs";
  return `${prefix}/role-${visualAssetKey(visualFamily, role)}.webp${roleArtRevision(visualFamily, role)}`;
}

export function roleThumbStyle(family: GameFamily, role: RoleCode) {
  return { "--role-art": `url("${roleThumbPath(family, role)}")` } as CSSProperties;
}

function visualAssetKey(family: GameFamily, role: RoleCode) {
  return family === "werewolves" && role === "jester" ? "jester-werewolf" : getRoleAssetKey(role);
}

// A changed URL also invalidates Next's optimized-image cache after an art refresh.
const refreshedRoleArt: Record<GameFamily, readonly RoleCode[]> = {
  werewolves: ["werewolf", "vampire", "insomniac"],
  mafia: ["doctor", "detective", "maniac", "lovers"],
};

function roleArtRevision(family: GameFamily, role: RoleCode) {
  // Portrait-format roles had their baked borders removed; informant was already unframed.
  if (!squareRoles[family].includes(role) && role !== "informant") return "?v=3";
  return refreshedRoleArt[family].includes(role) ? "?v=2" : "";
}
