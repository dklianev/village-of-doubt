import type { Metadata } from "next";
import { headers } from "next/headers";
import { JsonLd } from "@/components/JsonLd";
import { ReportLighthouse } from "@/components/report/ReportLighthouse";
import { ResourceHints } from "@/components/resource-hints";
import { auth } from "@/lib/auth";
import { absoluteUrl, routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  title: "Сигнал | Върколак и Мафия",
  description: "Подай сигнал — за нарушение, авторски права, бъг или жалба. Преглеждаме в 48 часа.",
  path: "/report",
  image: "/game-art/legal/report-banner.png",
  imageAlt: "Каменен фар сред мъгла",
  robots: { index: false, follow: false },
  absoluteTitle: true,
});

interface ReportPageProps {
  searchParams?: Promise<{ visualAuth?: string | string[]; visualStep?: string | string[] }>;
}

export default async function ReportPage({ searchParams }: ReportPageProps) {
  const params = await searchParams;
  const visualAuth = process.env.NODE_ENV !== "production" && firstSearchValue(params?.visualAuth) === "1";
  const visualStep = process.env.NODE_ENV !== "production" ? firstSearchValue(params?.visualStep) : undefined;
  const requestHeaders = await headers();
  const session = visualAuth
    ? { user: { email: "visual@example.com", name: "Визуален играч" } }
    : await auth.api.getSession({ headers: requestHeaders }).catch(() => null);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: "Сигнал",
    inLanguage: "bg-BG",
    url: absoluteUrl("/report"),
  };

  return (
    <main className="shell report-shell">
      <ResourceHints images={["/game-art/legal/report-banner.webp"]} />
      <JsonLd data={jsonLd} />
      <ReportLighthouse
        userEmail={session?.user?.email ?? null}
        userName={session?.user?.name ?? null}
        visualStep={visualStep === "review" || visualStep === "success" ? visualStep : null}
      />
    </main>
  );
}

function firstSearchValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
