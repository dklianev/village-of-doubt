import Image from "next/image";

const PHASES = [
  {
    key: "rain",
    label: "Дъждът тръгва по улиците",
    body: "Фенерът дава съвсем малко светлина. Барът затваря тихо.",
    art: "/game-art/mafia/night-1-rain.webp",
  },
  {
    key: "don",
    label: "Кръстникът вдига пистолет",
    body: "Жест без думи. Семейството го прочита от другия край на масата.",
    art: "/game-art/mafia/night-2-don.webp",
  },
  {
    key: "sheriff",
    label: "Комисарят отваря досие",
    body: "Има едно име, което не пасва. Тефтерът знае.",
    art: "/game-art/mafia/night-3-sheriff.webp",
  },
  {
    key: "doctor",
    label: "Докторът лекува тихо",
    body: "Чанта с принадлежности се отваря при правилната врата.",
    art: "/game-art/mafia/night-4-doctor.webp",
  },
  {
    key: "morning",
    label: "Вестникът пише сутринта",
    body: "Снимка на първа страница. Цигара угаснала във ваза.",
    art: "/game-art/mafia/night-5-morning.webp",
  },
] as const;

export function MafiaNightTimeline() {
  return (
    <section className="night-timeline night-timeline--mafia" aria-label="Как протича нощ в града">
      <header className="night-timeline__header family-section-plaque">
        <p className="section-kicker">град под напрежение</p>
        <h2>Тази нощ в града</h2>
        <p>Всичко е тихо, докато не излезе сутрешният вестник.</p>
      </header>

      <ol className="night-timeline__phases">
        {PHASES.map((phase, index) => (
          <li key={phase.key} className="night-phase" data-step={index + 1}>
            <figure className="night-phase__art">
              <Image
                src={phase.art}
                alt=""
                width={512}
                height={384}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                loading={index === 0 ? "eager" : "lazy"}
              />
              <span className="night-phase__step" aria-hidden="true">
                {index + 1}
              </span>
            </figure>
            <div className="night-phase__body">
              <h3>{phase.label}</h3>
              <p>{phase.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
