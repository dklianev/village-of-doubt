import type { Metadata } from "next";
import { GameRolesPage } from "@/components/games/game-roles-page";

export const metadata: Metadata = {
  title: "Роли във Върколак | Върколак и Мафия",
  description: "Ролите за Върколак по българските правила и PDF-a за „Върколаци — Голяма кутия“.",
};

export default function WerewolfRolesPage() {
  return <GameRolesPage family="werewolves" />;
}
