import type { GameFamily } from "../game-config.js";
import { MAFIA_RULES_BG } from "./mafia/rules.js";
import { WEREWOLF_RULES_BG } from "./werewolf/rules.js";

export { MAFIA_ROLE_DEFINITIONS } from "./mafia/roles.js";
export { MAFIA_RULES_BG } from "./mafia/rules.js";
export { WEREWOLF_ROLE_DEFINITIONS } from "./werewolf/roles.js";
export { WEREWOLF_RULES_BG } from "./werewolf/rules.js";
export type { GameRules, RoleDefinition, RoleDependency, RoleTag, TeamCode } from "./shared/types.js";

export function getRulesForFamily(family: GameFamily) {
  return family === "mafia" ? MAFIA_RULES_BG : WEREWOLF_RULES_BG;
}
