import type { Metadata } from "next";
import Link from "next/link";
import { ACHIEVEMENTS } from "@werewolf/shared";

export const metadata: Metadata = {
  title: "Постижения | Върколак и Мафия",
  description: "Колекция от replay-базирани моменти: първа кръв, спасени нощи, лични победи и финални обрати.",
};

export default function AchievementsPage() {
  return (
    <main className="shell utility-shell">
      <section className="paper-card utility-hero achievement-hero rounded-[2rem] p-8">
        <p className="section-kicker text-[#842f2b]">постижения</p>
        <h1 className="mt-3 text-5xl font-black">Малките легенди след всяка игра</h1>
        <p className="mt-4 max-w-3xl text-[#4f3829]">
          Постиженията не са grind. Те се отключват от replay събитията и разказват какво се е случило на масата:
          спасение, предателство, точен изстрел или самостоятелна победа.
        </p>
      </section>

      <section className="achievement-grid mt-6">
        {ACHIEVEMENTS.map((achievement) => (
          <article key={achievement.id} className="paper-card achievement-card rounded-[2rem] p-6">
            <span>{achievement.iconBg}</span>
            <h2>{achievement.titleBg}</h2>
            <p>{achievement.descriptionBg}</p>
          </article>
        ))}
      </section>

      <Link className="btn btn-secondary mt-6" href="/history">
        Виж replay история
      </Link>
    </main>
  );
}
