import type { Metadata } from "next";
import { GameHomePage } from "@/components/games/game-home-page";

export const metadata: Metadata = {
  title: "Върколак | Върколак и Мафия",
  description: "Фолклорен хорър за село, което трябва да преживее нощта.",
};

export default function WerewolfPage() {
  return <GameHomePage family="werewolves" />;
}
