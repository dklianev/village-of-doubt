import { JsonLd } from "@/components/JsonLd";
import { LandingExperience } from "@/components/landing-experience";
import { routeMetadata, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/seo";

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

const homeJsonLd = {
  "@context": "https://schema.org",
  "@type": ["WebSite", "SoftwareApplication"],
  name: SITE_NAME,
  url: SITE_URL,
  slogan: SITE_TAGLINE,
  description: "Онлайн социална игра с тайни роли. Поддържа Върколак и Мафия за частни стаи с приятели.",
  applicationCategory: "GameApplication",
  operatingSystem: "Web",
  inLanguage: "bg-BG",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "BGN",
    availability: "https://schema.org/InStock",
  },
  publisher: {
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
  },
};

export default function HomePage() {
  return (
    <>
      <JsonLd data={homeJsonLd} />
      <LandingExperience />
    </>
  );
}
