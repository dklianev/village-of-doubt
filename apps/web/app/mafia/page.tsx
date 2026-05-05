import type { Metadata } from "next";
import { GameHomePage } from "@/components/games/game-home-page";

export const metadata: Metadata = {
  title: "Мафия | Върколак и Мафия",
  description: "Криминален ноар за град, който трябва да различи алиби от лъжа.",
};

export default function MafiaPage() {
  return <GameHomePage family="mafia" />;
}
