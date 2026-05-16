import type { Metadata } from "next";
import Link from "next/link";
import { AchievementsClient } from "@/components/achievements-client";
import { requireSession } from "@/lib/require-session";
import { routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  title: "Постижения — малките легенди",
  description: "Колекция от моменти, отключени от записите: първа кръв, спасени нощи, лични победи и финални обрати.",
  path: "/achievements",
  image: "/game-art/og/og-achievements.png",
  imageAlt: "Стена с празни месингови плочи за постижения",
  ogDescription: "Плочи за спасения, предателства, точни изстрели и лични победи.",
});

export default async function AchievementsPage() {
  await requireSession("/achievements");

  return (
    <main className="shell utility-shell achievement-shell">
      <section className="paper-card utility-hero achievement-hero rounded-[2rem] p-8">
        <p className="section-kicker text-[#842f2b]">постижения</p>
        <h1 className="mt-3 text-5xl font-black">Малките легенди след всяка игра</h1>
        <p className="achievement-hero-lede mt-4 max-w-3xl">
          Гравираните плочи разказват какво се е случило на масата: спасение, предателство, точен изстрел или самостоятелна
          победа.
        </p>
      </section>

      <AchievementsClient />

      <Link className="btn btn-secondary mt-6" href="/history">
        Виж записаните игри
      </Link>
    </main>
  );
}
