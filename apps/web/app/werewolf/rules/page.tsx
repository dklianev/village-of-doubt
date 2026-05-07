import type { Metadata } from "next";
import { GameRulesPage } from "@/components/games/game-rules-page";

export const metadata: Metadata = {
  title: "Правила за Върколак | Върколак и Мафия",
  description: "Как се играе Върколак: нощ, ден, гласуване, Разказвач, роли и баланс.",
};

export default function WerewolfRulesPage() {
  return <GameRulesPage family="werewolves" />;
}
