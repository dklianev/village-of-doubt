import type { Metadata } from "next";
import { GameRolesPage } from "@/components/games/game-roles-page";

export const metadata: Metadata = {
  title: "Роли в Мафия | Върколак и Мафия",
  description: "Всички роли за Мафия с отделна ноар терминология и без смесване с Върколак.",
};

export default function MafiaRolesPage() {
  return <GameRolesPage family="mafia" />;
}
