import type { GameFamily } from "@werewolf/shared";

const WEREWOLF_VARIANTS = [
  { label: "Класически", body: "Селото срещу върколаците. Чистото предание." },
  { label: "С Влюбени", body: "Двама играчи делят съдба, дори срещу собствения отбор." },
  { label: "С Вампири", body: "Трета фракция в нощта. Кръв или зъби." },
  { label: "С Маниак", body: "Маниак сам срещу всички. Никой не е сигурен." },
] as const;

const MAFIA_VARIANTS = [
  { label: "Класическа Мафия", body: "Град срещу Мафия. Алибита и подозрения." },
  { label: "Комисар и Доктор", body: "Със стандартни роли за разследване и защита." },
  { label: "Кръстник с Адвокат", body: "Кръстник, който знае; адвокат, който мълчи." },
] as const;

export function VariantsChips({ family }: { family: GameFamily }) {
  const variants = family === "mafia" ? MAFIA_VARIANTS : WEREWOLF_VARIANTS;

  return (
    <section className="variants-chips" data-family={family} aria-label={family === "mafia" ? "Варианти на Мафия" : "Варианти на Върколак"}>
      <header className="variants-chips__header">
        <p className="section-kicker">варианти</p>
        <h2>{family === "mafia" ? "Различни кройки на града" : "Различни вечери в селото"}</h2>
      </header>
      <ul className="variants-chips__list">
        {variants.map((variant) => (
          <li key={variant.label} className="variant-chip">
            <strong>{variant.label}</strong>
            <span>{variant.body}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
