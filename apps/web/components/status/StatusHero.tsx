import Image from "next/image";
import type { ServiceStatusKind } from "@/lib/status-health";

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
    <header className="status-hero" aria-label="Състояние на услугите">
      <div className="status-hero-banner">
        <Image
          src="/game-art/legal/status-banner.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="status-hero-img"
        />
        <div className="status-hero-scrim" aria-hidden />
      </div>

      <div className="status-hero-inner">
        <p className="status-hero-kicker">състояние на услугите</p>
        <h1 className="status-hero-title">{copy.title}</h1>
        <p className="status-hero-subtitle">{copy.subtitle}</p>

        <div className="status-hero-meta" data-overall={overall}>
          <span className="status-hero-dot" aria-hidden />
          <span className="status-hero-meta-label">
            Последна проверка в{" "}
            <time className="status-hero-time" dateTime={lastCheckedAt}>
              {formatted}
            </time>
          </span>
          <button
            type="button"
            className="status-hero-refresh"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Опресни състоянието сега"
          >
            {refreshing ? "Проверяваме..." : "Опресни"}
          </button>
        </div>
      </div>
    </header>
  );
}
