import type { GameFamily } from "@werewolf/shared";
import { getRoleCatalog } from "@/lib/role-presentation.server";
import { GameRolesCatalog } from "./GameRolesCatalog";

export function GameRolesPage({ family }: { family: GameFamily }) {
  return <GameRolesCatalog key={family} family={family} catalog={getRoleCatalog(family)} />;
}
