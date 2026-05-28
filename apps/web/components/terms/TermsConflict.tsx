import Link from "next/link";

export function TermsConflict() {
  return (
    <section className="terms-section terms-section-conflict">
      <header className="terms-section-head">
        <p className="terms-section-kicker">когато нещо тръгне накриво</p>
        <h2>Стъпки при нарушение.</h2>
        <p className="terms-section-lede">
          Никой кодекс не е перфектен. Ето как реагираме, когато правилата се пречупят.
        </p>
      </header>

      <ol className="terms-conflict-steps">
        <li>
          <span className="terms-conflict-num">1</span>
          <div>
            <h3>Сигнал</h3>
            <p>
              Подаваш сигнал през <Link href="/report">страницата за сигнал</Link>. Описваш какво
              се е случило, кога и кой.
            </p>
          </div>
        </li>
        <li>
          <span className="terms-conflict-num">2</span>
          <div>
            <h3>Преглед</h3>
            <p>
              Преглеждаме сигнала в рамките на 48 часа. Може да поискаме допълнителни детайли по
              имейл.
            </p>
          </div>
        </li>
        <li>
          <span className="terms-conflict-num">3</span>
          <div>
            <h3>Решение</h3>
            <p>
              В зависимост от тежестта: предупреждение, временно ограничение или окончателно
              прекратяване. Първото нарушение обикновено е предупреждение.
            </p>
          </div>
        </li>
        <li>
          <span className="terms-conflict-num">4</span>
          <div>
            <h3>Право на отговор</h3>
            <p>
              Ако смяташ, че решението е грешно, можеш да възразиш през същата страница. Винаги
              проверяваме повторно.
            </p>
          </div>
        </li>
      </ol>
    </section>
  );
}
