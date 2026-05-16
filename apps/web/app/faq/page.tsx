import type { Metadata } from "next";
import { FaqClient } from "@/components/faq/FaqClient";
import { JsonLd } from "@/components/JsonLd";
import { ResourceHints } from "@/components/resource-hints";
import { FAQ_DATA, flattenAnswerForSchema } from "@/lib/faq-data";
import { absoluteUrl, routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  title: "Често задавани въпроси",
  description: "Отговори за геймплея, профила, техническите детайли и поверителността на Върколак и Мафия.",
  path: "/faq",
  image: "/game-art/og/og-faq.png",
  imageAlt: "Стар библиотечен каталог",
  ogDescription: "Геймплей, профил, техника, поверителност — отговорите на масата.",
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
      <ResourceHints images={["/game-art/faq/library-catalog-hero.webp"]} />
      <JsonLd data={faqJsonLd} />
      <FaqClient items={FAQ_DATA} />
    </main>
  );
}
