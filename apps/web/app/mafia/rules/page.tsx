import type { Metadata } from "next";
import { GameRulesPage } from "@/components/games/game-rules-page";

export const metadata: Metadata = {
  title: "Правила за Мафия | Върколак и Мафия",
  description: "Как се играе Мафия: нощни договорки, дневно обвинение и градска развръзка.",
};

export default function MafiaRulesPage() {
  return <GameRulesPage family="mafia" />;
}
