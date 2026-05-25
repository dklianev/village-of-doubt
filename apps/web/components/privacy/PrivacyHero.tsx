import { Display, SceneCard } from "@werewolf/ui/server";
import styles from "./PrivacyHero.module.css";

interface PrivacyHeroProps {
  lastUpdated: string;
  hasSnapshot: boolean;
}

export function PrivacyHero({ lastUpdated, hasSnapshot }: PrivacyHeroProps) {
  return (
    <header aria-label="Политика за поверителност" className={styles.heroFrame}>
      <SceneCard
        eyebrow="ПОЛИТИКА ЗА ПОВЕРИТЕЛНОСТ"
        density="lg"
        background={{ image: "var(--art-privacy)", overlay: "scrim", focalY: 42 }}
      >
        <Display size="h1">Твоите тайни остават при теб.</Display>
        <p className={styles.heroSubtitle}>
          Какво събираме, защо го пазим и как си господар на твоите данни.
          {hasSnapshot ? " По-долу виждаш точно какво знаем за теб." : ""}
        </p>
        <p className={styles.heroMeta}>
          Последна актуализация: <time>{lastUpdated}</time>
        </p>
      </SceneCard>
    </header>
  );
}
