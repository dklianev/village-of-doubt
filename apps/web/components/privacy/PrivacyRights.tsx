import Link from "next/link";

interface RightAction {
  id: string;
  title: string;
  description: string;
  href: string;
  external?: boolean;
  ctaLabel: string;
}

const RIGHTS: readonly RightAction[] = [
  {
    id: "access",
    title: "Право на достъп",
    description: "Виж точно какво пазим за теб в секция „Какво виждаме за теб точно сега“.",
    href: "/account",
    ctaLabel: "Към профила →",
  },
  {
    id: "portability",
    title: "Право на преносимост",
    description: "Изтегли JSON файл с цялата си история, готов за архив или импорт другаде.",
    href: "/api/account/export",
    ctaLabel: "Изтегли данни →",
  },
  {
    id: "rectification",
    title: "Право на корекция",
    description: "Промени име на масата или друга информация от профила.",
    href: "/account",
    ctaLabel: "Към профила →",
  },
  {
    id: "erasure",
    title: "Право на изтриване",
    description: "Изтрий профила окончателно. Заместваме името в игрите с „Изтрит играч“.",
    href: "/account",
    ctaLabel: "Към профила →",
  },
  {
    id: "objection",
    title: "Право на ограничаване и възражение",
    description: "Ако смяташ, че обработваме данните ти неправомерно — пиши ни.",
    href: "/report",
    ctaLabel: "Подай сигнал →",
  },
  {
    id: "complaint",
    title: "Право на жалба",
    description: "Можеш да подадеш жалба до Комисията за защита на личните данни.",
    href: "https://www.cpdp.bg",
    external: true,
    ctaLabel: "Към КЗЛД ↗",
  },
];

export function PrivacyRights() {
  return (
    <section className="privacy-section privacy-section-rights">
      <header className="privacy-section-head">
        <p className="privacy-section-kicker">твоите права</p>
        <h2>Какво можеш да направиш.</h2>
        <p className="privacy-section-lede">
          Шест права по GDPR — всяко с конкретен начин да го упражниш.
        </p>
      </header>

      <ul className="privacy-rights-grid">
        {RIGHTS.map((right) => (
          <li key={right.id}>
            <article className="privacy-right-card">
              <h3>{right.title}</h3>
              <p>{right.description}</p>
              {right.external ? (
                <a href={right.href} target="_blank" rel="noopener noreferrer" className="privacy-right-cta">
                  {right.ctaLabel}
                </a>
              ) : (
                <Link href={right.href} className="privacy-right-cta">
                  {right.ctaLabel}
                </Link>
              )}
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
