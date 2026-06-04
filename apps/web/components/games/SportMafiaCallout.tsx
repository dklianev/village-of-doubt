import Link from "next/link";

export function SportMafiaCallout() {
  return (
    <section className="sport-mafia-callout" aria-label="Спортна Мафия">
      <div className="sport-mafia-callout__plaque family-section-plaque">
        <p className="section-kicker">официална настройка</p>
        <h2>Спортна Мафия</h2>
        <p>Точно 10 играчи. Фиксирани таймери. Правилата на масата.</p>
      </div>
      <Link href="/mafia/create?mode=mafia_sport" className="quickstart-card-cta sport-mafia-callout__cta">
        Създай маса <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
