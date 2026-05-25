const CALLOUTS = [
  {
    label: "Алибито",
    body: "Всеки в града има история за нощта. Една не пасва.",
  },
  {
    label: "Сигналът на Кръстника",
    body: "Жест без думи. Семейството чете кога удря.",
  },
  {
    label: "Дневникът на Комисаря",
    body: "Една проверка на нощ. Една буква в тетрадката.",
  },
] as const;

export function MafiaMechanicsCallouts() {
  return (
    <section className="mafia-mechanics" aria-label="Механики на Мафия">
      <header className="mafia-mechanics__header family-section-plaque">
        <p className="section-kicker">тънкости</p>
        <h2>Как се играе Мафия наистина</h2>
      </header>
      <ul className="mafia-mechanics__list">
        {CALLOUTS.map((callout) => (
          <li key={callout.label} className="mafia-mechanic">
            <strong>{callout.label}</strong>
            <span>{callout.body}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
