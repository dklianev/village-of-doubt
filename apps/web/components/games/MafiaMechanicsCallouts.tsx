const CALLOUTS = [
  {
    label: "Алибито",
    body: "Сравнявай думите с гласовете. Кого защити този, когото подозираш?",
  },
  {
    label: "Изборът на Мафията",
    body: "Нощем Мафията трябва да посочи една и съща жертва. Без съгласие няма атака.",
  },
  {
    label: "Дневникът на Комисаря",
    body: "Една проверка на нощ. После трябва да убедиш Града, без да се издадеш твърде рано.",
  },
] as const;

export function MafiaMechanicsCallouts() {
  return (
    <section className="mafia-mechanics" aria-label="Механики на Мафия">
      <header className="mafia-mechanics__header family-section-heading">
        <p className="section-kicker">тънкости</p>
        <h2>Алибито не е доказателство.</h2>
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
