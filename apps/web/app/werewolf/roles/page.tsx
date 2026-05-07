import type { Metadata } from "next";
import { GameRolesPage } from "@/components/games/game-roles-page";

export const metadata: Metadata = {
  title: "Роли във Върколак | Върколак и Мафия",
  description: "Ролите за Върколак: селяни, Върколаци, Вампири и Разказвач.",
};

export default function WerewolfRolesPage() {
  return <GameRolesPage family="werewolves" />;
}
