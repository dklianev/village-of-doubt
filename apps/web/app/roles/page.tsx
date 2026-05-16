import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  title: "Роли — всички тайни карти",
  description: "Общ вход към справочниците за роли във Върколак и Мафия: тайни карти, отбори, нощни действия и условия за победа.",
  path: "/roles",
  image: "/game-art/og/og-home.png",
  imageAlt: "Нощно село и нощен град",
  ogDescription: "Всички тайни карти на една маса.",
});

export default function RolesPage() {
  redirect("/werewolf/roles");
}
