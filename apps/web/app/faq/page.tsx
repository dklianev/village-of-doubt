import type { Metadata } from "next";
import { FaqHearth } from "@/components/faq/FaqHearth";
import { JsonLd } from "@/components/JsonLd";
import { ResourceHints } from "@/components/resource-hints";
import { FAQ_DATA, flattenAnswerForSchema } from "@/lib/faq-data";
import { absoluteUrl, routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  title: "Седни до огъня | Върколак и Мафия",
  description: "Отговори за геймплея, профила, техническите детайли и поверителността — споделени до огъня.",
  path: "/faq",
  image: "/game-art/legal/faq-hearth-banner.png",
  imageAlt: "Каменно огнище с книги и свещ",
  absoluteTitle: true,
});

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  url: absoluteUrl("/faq"),
  inLanguage: "bg-BG",
  mainEntity: FAQ_DATA.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: flattenAnswerForSchema(item.answer),
    },
  })),
};

export default function FaqPage() {
  return (
    <main className="shell faq-shell">
      <ResourceHints images={["/game-art/legal/faq-hearth-banner.webp"]} />
      <JsonLd data={faqJsonLd} />
      <FaqHearth items={FAQ_DATA} />
    </main>
  );
}
