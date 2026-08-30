import { JsonLd } from "@/components/JsonLd";
import { LandingExperience } from "@/components/landing-experience";
import { routeMetadata, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/seo";

export const metadata = routeMetadata({
  title: "Върколак и Мафия — социална игра на сенки",
  description:
    "Върколак и Мафия онлайн с тайни роли и частни стаи. Създай маса, покани приятелите си и виж на кого ще повярваш.",
  path: "/",
  image: "/game-art/og/og-home.png",
  imageAlt: "Нощно село и нощен град",
  ogDescription: "Тайни роли, частна стая и компания, в която някой лъже. Избери игра и събери масата.",
  type: "website",
  absoluteTitle: true,
});

const homeJsonLd = {
  "@context": "https://schema.org",
  "@type": ["WebSite", "SoftwareApplication"],
  name: SITE_NAME,
  url: SITE_URL,
  slogan: SITE_TAGLINE,
  description: "Онлайн социална игра с тайни роли за приятелски компании. Избери Върколак или Мафия, създай стая и покани своите хора.",
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
      <LandingExperience initialSession={null} />
    </>
  );
}
