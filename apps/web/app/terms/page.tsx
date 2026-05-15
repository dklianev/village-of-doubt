import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Условия | Върколак и Мафия",
  description: "Основни условия за ползване на сайта и игровите стаи.",
};

export default function TermsPage() {
  return (
    <main className="shell utility-shell legal-shell">
      <section className="paper-card legal-card rounded-[2rem] p-8">
        <p className="section-kicker text-[#842f2b]">условия</p>
        <h1 className="mt-3 text-5xl font-black">Условия за ползване</h1>
        <div className="legal-copy mt-6">
          <p>Услугата е за играчи на 13 или повече години.</p>
          <p>Не допускаме тормоз, злоупотреба със стаи, автоматизирано натоварване или подвеждащи профили.</p>
          <p>Играта се предоставя във вида, в който е налична. Възможни са прекъсвания, промени и временни ограничения.</p>
          <p>При нарушение можем да ограничим достъпа до профил, стая или публични функции.</p>
        </div>
      </section>
    </main>
  );
}
