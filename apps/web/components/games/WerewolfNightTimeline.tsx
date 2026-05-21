import Image from "next/image";

const PHASES = [
  {
    key: "fog",
    label: "Първо мъглата",
    body: "Селото потъва в мъгла. Никой не вижда повече от вратата си.",
    art: "/game-art/werewolf/night-1-fog.webp",
  },
  {
    key: "seer",
    label: "Гадателката отваря очи",
    body: "Една жена пита луната чие сърце бие нечовешки.",
    art: "/game-art/werewolf/night-2-seer.webp",
  },
  {
    key: "wolves",
    label: "Върколаците избират",
    body: "Сенки се събират в гората и сочат прозорец.",
    art: "/game-art/werewolf/night-3-wolves.webp",
  },
  {
    key: "healer",
    label: "Лечителят пази",
    body: "Стара билка под възглавница може да удържи зъбите.",
    art: "/game-art/werewolf/night-4-healer.webp",
  },
  {
    key: "dawn",
    label: "Сутринта селото брои",
    body: "Камбана. Някой не отговаря. Денят започва с подозрения.",
    art: "/game-art/werewolf/night-5-dawn.webp",
  },
] as const;

export function WerewolfNightTimeline() {
  return (
    <section className="night-timeline night-timeline--werewolves" aria-label="Как протича нощ в село Върколак">
      <header className="night-timeline__header">
        <p className="section-kicker">нощ над селото</p>
        <h2>Това е една нощ</h2>
        <p>Всичко започва с тишина. Завършва с име, изречено на глас.</p>
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
