import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { ResourceHints } from "@/components/resource-hints";
import { StatusDashboard } from "@/components/status/StatusDashboard";
import { absoluteUrl, routeMetadata } from "@/lib/seo";
import { loadStatusServices } from "@/lib/status-health";

export const dynamic = "force-dynamic";

export const metadata: Metadata = routeMetadata({
  title: "Състояние | Върколак и Мафия",
  description: "Преглед на здравето на услугите ни. Колко бързо отговаряме, кога нещо се е счупило.",
  path: "/status",
  image: "/game-art/legal/status-banner.png",
  imageAlt: "Каменно пристанище в полумрак",
  robots: { index: false, follow: true },
  absoluteTitle: true,
});

export default async function StatusPage() {
  const services = await loadStatusServices();
  const lastCheckedAt = new Date().toISOString();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Състояние",
    inLanguage: "bg-BG",
    url: absoluteUrl("/status"),
  };

  return (
    <main className="shell status-shell">
      <ResourceHints images={["/game-art/legal/status-banner.webp"]} />
      <JsonLd data={jsonLd} />
      <StatusDashboard
        initialServices={services}
        initialLastCheckedAt={lastCheckedAt}
        discordUrl={process.env.NEXT_PUBLIC_DISCORD_URL ?? null}
        telegramUrl={process.env.NEXT_PUBLIC_TELEGRAM_URL ?? null}
      />
    </main>
  );
}
