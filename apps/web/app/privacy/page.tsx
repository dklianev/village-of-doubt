import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Поверителност | Върколак и Мафия",
  description: "Кратко описание какви данни пазим за профили, игри и сесии.",
};

export default function PrivacyPage() {
  return (
    <main className="shell utility-shell legal-shell">
      <section className="paper-card legal-card rounded-[2rem] p-8">
        <p className="section-kicker text-[#842f2b]">поверителност</p>
        <h1 className="mt-3 text-5xl font-black">Политика за поверителност</h1>
        <div className="legal-copy mt-6">
          <p>
            Събираме само данните, нужни за профил и игра: имейл, име, идентификатор от доставчика за вход,
            записани игри, постижения и статистики.
          </p>
          <p>
            Използваме тези данни, за да пазим сесиите, историята, класацията, поканите и личните постижения.
          </p>
          <p>
            Не продаваме данни и не използваме проследяващи бисквитки. Бисквитките са само за вход и сесия.
          </p>
          <p>
            Можеш да поискаш изтриване на профила от <Link href="/account">страницата на профила</Link>.
          </p>
        </div>
      </section>
    </main>
  );
}
