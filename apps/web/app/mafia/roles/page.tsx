import type { Metadata } from "next";
import { GameRolesPage } from "@/components/games/game-roles-page";
import { routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  title: "Роли в Мафия — градски досиета",
  description: "Справочник за ролите в Мафия: Град, Мафия, Дон, Комисар, Доктор, независими роли и ноар варианти.",
  path: "/mafia/roles",
  image: "/game-art/og/og-mafia.png",
  imageAlt: "Дъждовна градска улица под фенер",
  ogDescription: "Досиета за града: кой пази алиби и кой търси истината.",
});

export default function MafiaRolesPage() {
  return <GameRolesPage family="mafia" />;
}
