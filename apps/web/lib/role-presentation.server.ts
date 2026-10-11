import {
  ROLE_DEFINITIONS,
  getRoleRuntimeStatus,
  getRolesForFamily,
  teamLabelBg,
  type GameFamily,
  type RoleCode,
  type RoleDefinition,
} from "@werewolf/shared";
import { roleArtSource } from "./role-art";

const KNOWN_WEREWOLF_ROLE_ASSETS = new Set([
  "ordinary-villager", "werewolf", "seer", "witch", "healer", "priest", "hunter", "cupid",
  "vampire", "red-riding-hood", "oracle", "cook", "blacksmith", "insomniac", "vampire-hunter",
  "investigator", "drunk", "stray-cat", "guard-dog", "little-girl", "thief", "jester", "mayor",
]);
const KNOWN_MAFIA_ROLE_ASSETS = new Set([
  "civilian", "commissioner", "don", "mafioso", "doctor", "detective", "bodyguard", "vigilante",
  "medium", "roleblocker", "lawyer", "informant", "maniac", "jester", "mayor", "lovers",
]);

export type RolePresentation = Pick<RoleDefinition,
  | "nameBg" | "shortDescriptionBg" | "fullDescriptionBg" | "team"
  | "value" | "nightOrder" | "isDefaultEnabled" | "minPlayers" | "maxCopies"
  | "dependencies" | "tags" | "nightAction" | "availableInFamilies"
> & {
  id: RoleCode;
  advanced: boolean;
  runtimeStatus: "playable" | "manual_only" | "disabled";
  teamLabel: string;
  art: { src: string; width: number; height: number };
};

// Project only the selected public catalogue at the Server Component boundary.
// Client consumers import the type, never the full shared role registry.
export function getRolePresentation(family: GameFamily, role: RoleCode): RolePresentation {
  const definition: RoleDefinition = ROLE_DEFINITIONS[role];
  const hasArt = (family === "mafia" ? KNOWN_MAFIA_ROLE_ASSETS : KNOWN_WEREWOLF_ROLE_ASSETS).has(definition.assetKey);
  return {
    id: role,
    nameBg: definition.nameBg,
    shortDescriptionBg: definition.shortDescriptionBg,
    fullDescriptionBg: definition.fullDescriptionBg,
    team: definition.team,
    value: definition.value,
    nightOrder: definition.nightOrder,
    isDefaultEnabled: definition.isDefaultEnabled,
    minPlayers: definition.minPlayers,
    maxCopies: definition.maxCopies,
    dependencies: definition.dependencies,
    tags: definition.tags,
    nightAction: definition.nightAction,
    availableInFamilies: definition.availableInFamilies,
    advanced: definition.advanced ?? false,
    runtimeStatus: getRoleRuntimeStatus(role),
    teamLabel: teamLabelBg(definition.team, family),
    art: hasArt ? roleArtSource(family, role) : { src: "/game-art/card-back-secret.webp", width: 1024, height: 1536 },
  };
}

export function getRoleCatalog(family: GameFamily): readonly RolePresentation[] {
  return getRolesForFamily(family).map((role) => getRolePresentation(family, role));
}
