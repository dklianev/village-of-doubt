import Link from "next/link";
import { Display, PaperCard } from "@werewolf/ui/server";
import styles from "./PrivacyRights.module.css";

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
    ctaLabel: "Към досието →",
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
    description: "Промени име на масата или друга информация от досието.",
    href: "/account",
    ctaLabel: "Към досието →",
  },
  {
    id: "erasure",
    title: "Право на изтриване",
    description: "Изтрий досието окончателно. Заместваме името в игрите с „Изтрит играч“.",
    href: "/account",
    ctaLabel: "Към досието →",
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
    <section className={`privacy-section ${styles.rightsSection}`}>
      <PaperCard eyebrow="ТВОИТЕ ПРАВА" density="lg">
        <header className="privacy-section-head">
          <Display as="h2" size="h3">
            Какво можеш да направиш.
          </Display>
          <p className="privacy-section-lede">
            Шест права по GDPR — всяко с конкретен начин да го упражниш.
          </p>
        </header>

        <ul className={styles.rightsGrid}>
          {RIGHTS.map((right) => (
            <li key={right.id}>
              <article className={styles.rightCard}>
                <h3>{right.title}</h3>
                <p>{right.description}</p>
                {right.external ? (
                  <a href={right.href} target="_blank" rel="noopener noreferrer" className={styles.rightCta}>
                    {right.ctaLabel}
                  </a>
                ) : (
                  <Link href={right.href} className={styles.rightCta}>
                    {right.ctaLabel}
                  </Link>
                )}
              </article>
            </li>
          ))}
        </ul>
      </PaperCard>
    </section>
  );
}
