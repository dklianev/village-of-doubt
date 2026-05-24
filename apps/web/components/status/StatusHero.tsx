import { Display, SceneCard } from "@werewolf/ui";
import type { ServiceStatusKind } from "@/lib/status-health";
import styles from "./Status.module.css";

interface StatusHeroProps {
  overall: ServiceStatusKind;
  lastCheckedAt: string;
  refreshing: boolean;
  onRefresh: () => void;
}

const OVERALL_COPY: Record<ServiceStatusKind, { title: string; subtitle: string }> = {
  ok: {
    title: "Светилникът свети.",
    subtitle: "Всички основни услуги работят нормално.",
  },
  degraded: {
    title: "Леки вълни на хоризонта.",
    subtitle: "Една или повече услуги са в неизвестно или забавено състояние.",
  },
  down: {
    title: "Авария на хоризонта.",
    subtitle: "Засечено е прекъсване в основна услуга. Работим по решение.",
  },
  unknown: {
    title: "Светилникът се настройва.",
    subtitle: "Все още нямаме пълна видимост над услугите.",
  },
};

export function StatusHero({ overall, lastCheckedAt, refreshing, onRefresh }: StatusHeroProps) {
  const copy = OVERALL_COPY[overall];
  const formatted = new Intl.DateTimeFormat("bg-BG", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(lastCheckedAt));

  return (
    <header
      aria-label="Състояние на услугите"
      style={{ maxWidth: "980px", margin: "0 auto", padding: "32px 24px 0" }}
    >
      <SceneCard eyebrow="СЪСТОЯНИЕ НА УСЛУГИТЕ" density="lg">
        <Display size="h1">{copy.title}</Display>
        <p
          style={{
            color: "var(--ds-ink-scene-soft)",
            fontSize: "var(--ds-type-lede)",
            lineHeight: 1.55,
            margin: 0,
          }}
        >
          {copy.subtitle}
        </p>

        <div className={styles.heroMeta} data-overall={overall}>
          <span className={styles.heroDot} aria-hidden />
          <span className={styles.heroMetaLabel}>
            Последна проверка в{" "}
            <time className="status-hero-time" dateTime={lastCheckedAt}>
              {formatted}
            </time>
          </span>
          <button
            type="button"
            className={styles.heroRefresh}
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Опресни състоянието сега"
          >
            {refreshing ? "Проверяваме..." : "Опресни"}
          </button>
        </div>
      </SceneCard>
    </header>
  );
}
