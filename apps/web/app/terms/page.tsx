import type { Metadata } from "next";
import { headers } from "next/headers";
import { JsonLd } from "@/components/JsonLd";
import { ResourceHints } from "@/components/resource-hints";
import { TermsCodex } from "@/components/terms/TermsCodex";
import { auth } from "@/lib/auth";
import { absoluteUrl, routeMetadata } from "@/lib/seo";

const LAST_UPDATED = "19 май 2026";

export const metadata: Metadata = routeMetadata({
  title: "Кодекс на масата | Върколак и Мафия",
  description: "Правилата, които правят масата честна — за блъфа, за уважението, за чистата игра.",
  path: "/terms",
  image: "/game-art/legal/terms-banner.png",
  imageAlt: "Ръкостискане над масата под светлина на свещ",
  robots: { index: true, follow: true },
  absoluteTitle: true,
});

interface TermsPageProps {
  searchParams?: Promise<{ visualAuth?: string | string[] }>;
}

export default async function TermsPage({ searchParams }: TermsPageProps) {
  const params = await searchParams;
  const visualAuth = process.env.NODE_ENV !== "production" && firstSearchValue(params?.visualAuth) === "1";
  const requestHeaders = await headers();
  const session = visualAuth
    ? { user: { id: "visual-user", name: "Визуален играч" } }
    : await auth.api.getSession({ headers: requestHeaders }).catch(() => null);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Кодекс на масата",
    inLanguage: "bg-BG",
    dateModified: "2026-05-19",
    url: absoluteUrl("/terms"),
  };

  return (
    <main className="shell terms-shell">
      <ResourceHints images={["/game-art/legal/terms-banner.webp"]} />
      <JsonLd data={jsonLd} />
      <TermsCodex
        lastUpdated={LAST_UPDATED}
        isAuthenticated={Boolean(session?.user?.id)}
        userName={session?.user?.name ?? null}
      />
    </main>
  );
}

function firstSearchValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
