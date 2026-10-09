import type { Metadata } from "next";
import "@/components/legal/LegalShell.module.css";
import "@/components/terms/LegacyTerms.module.css";
import { JsonLd } from "@/components/JsonLd";
import { TermsCodex } from "@/components/terms/TermsCodex";
import { absoluteUrl, routeMetadata } from "@/lib/seo";

export const prefetch = "partial";
export const ensureStatic = "navigation";

const LAST_UPDATED = "19 май 2026";

export const metadata: Metadata = routeMetadata({
  title: "Условия за ползване",
  description: "Условия за ползване на Сенките, правила за честна игра и контакт при въпроси.",
  path: "/terms",
  image: "/game-art/legal/terms-banner.png",
  imageAlt: "Ръкостискане над масата под светлина на свещ",
  robots: { index: true, follow: true },
});

export default function TermsPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Условия за ползване",
    inLanguage: "bg-BG",
    dateModified: "2026-05-19",
    url: absoluteUrl("/terms"),
  };

  return (
    <main className="shell legal-page-shell terms-shell">
      <JsonLd data={jsonLd} />
      <TermsCodex lastUpdated={LAST_UPDATED} />
    </main>
  );
}
