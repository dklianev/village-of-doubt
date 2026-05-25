import { Display, SceneCard } from "@werewolf/ui/server";
import styles from "./ReportHero.module.css";

export function ReportHero() {
  return (
    <header aria-label="Сигнал" className={styles.heroFrame}>
      <SceneCard
        eyebrow="СИГНАЛ"
        density="lg"
        background={{
          image: "var(--art-report)",
          overlay: "scrim",
          focalY: 40,
          minHeight: "var(--ds-scene-hero-min-standard)",
        }}
      >
        <Display size="hero">Светим за тебе.</Display>
        <p className={styles.heroSubtitle}>
          Ако нещо не е наред — играч с неуместно поведение, спорно съдържание или нарушение на
          авторски права — кажи ни. Светилникът няма да угасне, докато не разгледаме.
        </p>
        <p className={styles.heroStat}>
          <span className={styles.heroStatIcon} aria-hidden>
            ⏱
          </span>
          <span>
            Обикновено отговаряме в <strong>24-48 часа</strong>
          </span>
        </p>
      </SceneCard>
    </header>
  );
}
