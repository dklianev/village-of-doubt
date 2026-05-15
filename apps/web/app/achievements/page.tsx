import type { Metadata } from "next";
import Link from "next/link";
import { AchievementsClient } from "@/components/achievements-client";

export const metadata: Metadata = {
  title: "Постижения | Върколак и Мафия",
  description: "Колекция от моменти, отключени от записите: първа кръв, спасени нощи, лични победи и финални обрати.",
};

export default function AchievementsPage() {
  return (
    <main className="shell utility-shell">
      <section className="paper-card utility-hero achievement-hero rounded-[2rem] p-8">
        <p className="section-kicker text-[#842f2b]">постижения</p>
        <h1 className="mt-3 text-5xl font-black">Малките легенди след всяка игра</h1>
        <p className="mt-4 max-w-3xl text-[#4f3829]">
          Постиженията не са повтаряне. Те се отключват от събитията в записа и разказват какво се е случило на масата:
          спасение, предателство, точен изстрел или самостоятелна победа.
        </p>
      </section>

      <AchievementsClient />

      <Link className="btn btn-secondary mt-6" href="/history">
        Виж записаните игри
      </Link>
    </main>
  );
}
