import type { Metadata } from "next";
import { GameRolesPage } from "@/components/games/game-roles-page";
import { routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  title: "Роли във Върколак — селският справочник",
  description: "Справочник за ролите във Върколак: селяни, Върколаци, Вампири, защити, проверки и редки разширени карти.",
  path: "/werewolf/roles",
  image: "/game-art/og/og-werewolf.png",
  imageAlt: "Лунна нощ над българско село",
  ogDescription: "Кой вижда, кой пази и кой лъже след полунощ.",
});

export default function WerewolfRolesPage() {
  return <GameRolesPage family="werewolves" />;
}
