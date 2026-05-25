import { Display, SceneCard } from "@werewolf/ui/server";
import styles from "./TermsHero.module.css";

export function TermsHero({ lastUpdated }: { lastUpdated: string }) {
  return (
    <header aria-label="Кодекс на масата" className={styles.heroFrame}>
      <SceneCard
        eyebrow="КОДЕКС НА МАСАТА"
        density="lg"
        background={{
          image: "var(--art-terms)",
          overlay: "scrim",
          focalY: 40,
          minHeight: "var(--ds-scene-hero-min-standard)",
        }}
      >
        <Display size="hero">Сядаме на една маса.</Display>
        <p className={styles.heroSubtitle}>
          Правилата, които правят играта честна — за блъфа, за уважението, за чистата игра. Това не
          са юридически клопки, а обещания между играчи.
        </p>
        <p className={styles.heroMeta}>
          Последна актуализация: <time>{lastUpdated}</time>
        </p>
      </SceneCard>
    </header>
  );
}
