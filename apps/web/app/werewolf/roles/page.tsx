import type { Metadata } from "next";
import { ROLE_DEFINITIONS, getRolesForFamily } from "@werewolf/shared";
import { JsonLd } from "@/components/JsonLd";
import { GameRolesPage } from "@/components/games/game-roles-page";
import { absoluteUrl, routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  title: "Роли във Върколак — селският справочник",
  description: "Справочник за ролите във Върколак: селяни, Върколаци, Вампири, защити, проверки и редки разширени карти.",
  path: "/werewolf/roles",
  image: "/game-art/og/og-werewolf.png",
  imageAlt: "Лунна нощ над българско село",
  ogDescription: "Кой вижда, кой пази и кой лъже след полунощ.",
});

const werewolfRolesJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Роли във Върколак",
  url: absoluteUrl("/werewolf/roles"),
  inLanguage: "bg-BG",
  itemListElement: getRolesForFamily("werewolves").map((role, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: ROLE_DEFINITIONS[role].nameBg,
    description: ROLE_DEFINITIONS[role].shortDescriptionBg,
  })),
};

export default function WerewolfRolesPage() {
  return (
    <>
      <JsonLd data={werewolfRolesJsonLd} />
      <GameRolesPage family="werewolves" />
    </>
  );
}
