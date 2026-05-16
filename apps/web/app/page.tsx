import { LandingExperience } from "@/components/landing-experience";
import { routeMetadata } from "@/lib/seo";

export const metadata = routeMetadata({
  title: "Върколак и Мафия — социална игра на сенки",
  description:
    "Онлайн Върколак и Мафия с тайни роли, частни стаи, авторитетен игрови сървър и истории, които се помнят между приятели.",
  path: "/",
  image: "/game-art/og/og-home.png",
  imageAlt: "Нощно село и нощен град",
  ogDescription: "Тайни роли, частни стаи, една вечер на масата. Играй с приятели без бот игра.",
  type: "website",
  absoluteTitle: true,
});

export default function HomePage() {
  return <LandingExperience />;
}
