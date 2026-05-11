import type { CSSProperties } from "react";
import { getRoleAssetKey, type GameFamily, type RoleCode } from "@werewolf/shared";

export function roleArtPath(family: GameFamily, role: RoleCode, extension: "png" | "webp" = "webp") {
  const prefix = family === "mafia" ? "/game-art/mafia" : "/game-art";
  return `${prefix}/role-${getRoleAssetKey(role)}.${extension}`;
}

export function roleThumbPath(family: GameFamily, role: RoleCode) {
  const prefix = family === "mafia" ? "/game-art/thumbs/mafia" : "/game-art/thumbs";
  return `${prefix}/role-${getRoleAssetKey(role)}.webp`;
}

export function roleThumbStyle(family: GameFamily, role: RoleCode) {
  return { "--role-art": `url("${roleThumbPath(family, role)}")` } as CSSProperties;
}
