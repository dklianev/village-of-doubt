import type { Metadata } from "next";
import { ROLE_DEFINITIONS, getRolesForFamily } from "@werewolf/shared";
import { JsonLd } from "@/components/JsonLd";
import { GameRolesPage } from "@/components/games/game-roles-page";
import { absoluteUrl, routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  title: "Роли в Мафия — градски досиета",
  description: "Справочник за ролите в Мафия: Град, Мафия, Дон, Комисар, Доктор, независими роли и ноар варианти.",
  path: "/mafia/roles",
  image: "/game-art/og/og-mafia.png",
  imageAlt: "Дъждовна градска улица под фенер",
  ogDescription: "Досиета за града: кой пази алиби и кой търси истината.",
});

const mafiaRolesJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Роли в Мафия",
  url: absoluteUrl("/mafia/roles"),
  inLanguage: "bg-BG",
  itemListElement: getRolesForFamily("mafia").map((role, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: ROLE_DEFINITIONS[role].nameBg,
    description: ROLE_DEFINITIONS[role].shortDescriptionBg,
  })),
};

export default function MafiaRolesPage() {
  return (
    <>
      <JsonLd data={mafiaRolesJsonLd} />
      <GameRolesPage family="mafia" />
    </>
  );
}
