import type { Metadata } from "next";
import Link from "next/link";
import { ResourceHints } from "@/components/resource-hints";
import { routeMetadata } from "@/lib/seo";

export const metadata: Metadata = routeMetadata({
  title: "Условия | Върколак и Мафия",
  description: "Условия за профили, стаи, поведение и ползване на играта.",
  path: "/terms",
  image: "/game-art/og/og-home.png",
  imageAlt: "Нощно село и нощен град",
  robots: { index: false, follow: true },
  absoluteTitle: true,
});

const LAST_UPDATED = "16 май 2026";

export default function TermsPage() {
  return (
    <main className="shell handshake-shell">
      <ResourceHints images={["/game-art/auth/terms-handshake.webp"]} />
      <section className="handshake-stage">
        <figure className="handshake-art" aria-hidden />

        <article className="handshake-card">
          <header className="handshake-head">
            <p className="handshake-kicker">условия за ползване</p>
            <h1>Сядаме на една маса.</h1>
            <p className="handshake-meta">Последна актуализация: {LAST_UPDATED}</p>
          </header>

          <section className="handshake-section">
            <h2>1. Приемане на условията</h2>
            <p>
              Като използваш "Върколак и Мафия", създаваш профил или влизаш в стая, приемаш тези условия.
              Ако не си съгласен, не използвай услугата.
            </p>
          </section>

          <section className="handshake-section">
            <h2>2. Възрастови ограничения</h2>
            <p>
              Услугата е предназначена за играчи на 13 или повече години. Ако си под 18 години, използваш
              платформата със знанието и съгласието на родител или настойник.
            </p>
          </section>

          <section className="handshake-section">
            <h2>3. Твоят профил</h2>
            <p>
              Отговаряш за имейла, паролата и активността от профила си. Избери име на масата, което не
              подвежда, не имитира друг човек и не нарушава добрия тон.
            </p>
            <p>При подозрение за компрометиран профил можем временно да ограничим достъпа, докато проверим случая.</p>
          </section>

          <section className="handshake-section">
            <h2>4. Поведение в играта</h2>
            <p>Социалната дедукция допуска блъф, спор и напрежение, но не допуска злоупотреба. Забранени са:</p>
            <ul>
              <li>тормоз, заплахи, омраза или унижение към играчи;</li>
              <li>публикуване на лични данни за друг човек;</li>
              <li>чийтове, автоматизирани заявки или умишлено натоварване на сървърите;</li>
              <li>саботиране на стаи извън нормалните правила на играта;</li>
              <li>съдържание, което нарушава закон или чужди права.</li>
            </ul>
          </section>

          <section className="handshake-section">
            <h2>5. Интелектуална собственост</h2>
            <p>
              Името на платформата, дизайнът, кодът, правилата в сайта и визуалните материали са защитени като
              наше съдържание или съдържание, за което имаме право на ползване. Можеш да споделяш линкове към
              стаи и страници, но не можеш да копираш платформата като собствена услуга.
            </p>
          </section>

          <section className="handshake-section">
            <h2>6. Съдържание от играчи</h2>
            <p>
              Имената на масата, съобщенията в стая и сигналите са съдържание, което въвеждаш ти. Даваш ни
              ограничено право да го показваме, съхраняваме и обработваме само доколкото е нужно за работата на
              играта, модерацията и историята на стаите.
            </p>
          </section>

          <section className="handshake-section">
            <h2>7. Услугата във вида, в който е налична</h2>
            <p>
              Работим да поддържаме играта стабилна, но не гарантираме непрекъснат достъп. Възможни са
              прекъсвания, промени в правилата, техническа поддръжка и временни ограничения.
            </p>
          </section>

          <section className="handshake-section">
            <h2>8. Ограничаване на отговорност</h2>
            <p>
              Не носим отговорност за косвени вреди, пропуснати ползи, загубена игрова статистика при технически
              срив или поведение на други играчи извън нашия разумен контрол.
            </p>
          </section>

          <section className="handshake-section">
            <h2>9. Прекратяване на достъп</h2>
            <p>
              Можем да ограничим или прекратим достъп до профил, стая или функция при нарушение на тези условия,
              риск за сигурността или законово задължение. Когато е разумно, ще дадем обяснение и възможност за
              сигнал през <Link href="/report">страницата за сигнал</Link>.
            </p>
          </section>

          <section className="handshake-section">
            <h2>10. Приложимо право</h2>
            <p>
              Тези условия се тълкуват според българското право. При спор страните първо търсят доброволно
              уреждане. Ако това не е възможно, компетентни са съдилищата в София, освен ако законът изисква друго.
            </p>
          </section>

          <section className="handshake-section">
            <h2>11. Контакт</h2>
            <p>
              За въпроси, сигнали и искания използвай <Link href="/report">страницата за сигнал</Link>. За лични
              данни виж и <Link href="/privacy">политиката за поверителност</Link>.
            </p>
          </section>

          <footer className="handshake-foot">
            <Link href="/" className="handshake-foot-link">Към началото</Link>
          </footer>
        </article>
      </section>
    </main>
  );
}
