import type { GameFamily } from "@werewolf/shared";
import { ThemedHeroPreload } from "@/components/themed-hero-preload";

export function FamilyHeroPreload({ family }: { family: GameFamily }) {
  return <ThemedHeroPreload scene={family === "mafia" ? "mafia" : "werewolf"} />;
}
