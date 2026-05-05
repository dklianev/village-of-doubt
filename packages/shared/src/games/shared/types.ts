import type { GameFamily } from "../../game-config.js";

export const TEAM_CODES = [
  "village",
  "werewolves",
  "vampires",
  "mafia",
  "lovers",
  "neutral",
] as const;

export type TeamCode = (typeof TEAM_CODES)[number];

export type RoleTag =
  | "основна"
  | "разширена"
  | "промо"
  | "нощна роля"
  | "защитна"
  | "разследваща"
  | "атакуваща"
  | "неутрална"
  | "еднократна"
  | "публична"
  | "селяни"
  | "град"
  | "върколаци"
  | "вампири"
  | "мафия";

export interface RoleDependency {
  roleId: string;
  reasonBg: string;
}

export interface RoleDefinition {
  id: string;
  gameId: GameFamily;
  nameBg: string;
  shortDescriptionBg: string;
  fullDescriptionBg: string;
  team: TeamCode;
  value: number;
  nightOrder: number | null;
  isDefaultEnabled: boolean;
  minPlayers: number;
  maxCopies: number;
  dependencies: readonly RoleDependency[];
  assetKey: string;
  tags: readonly RoleTag[];
  secret: boolean;
  nightAction: boolean;
  runtimeStatus?: "playable" | "manual_only" | "disabled";
  advanced?: boolean;
  availableInFamilies: readonly GameFamily[];
  winConditionBg?: string;
}

export interface RuleSection {
  titleBg: string;
  bodyBg: string;
  bulletsBg?: readonly string[];
}

export interface GameRules {
  gameId: GameFamily;
  titleBg: string;
  introBg: string;
  sections: readonly RuleSection[];
}
