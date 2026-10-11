import { RefreshCw } from "lucide-react";
import type { ServiceStatusKind } from "@/lib/status-health-shared";
import { formatBulgarianDateTime } from "@/lib/date-time";

interface StatusHeroProps {
  overall: ServiceStatusKind;
  lastCheckedAt: string;
  refreshing: boolean;
  refreshFailed?: boolean;
  onRefresh: () => void;
}

const OVERALL_COPY: Record<ServiceStatusKind, string> = {
  ok: "Основните услуги отговарят на проверките.",
  degraded: "Установена е частична недостъпност или забавяне.",
  down: "Проверката установи недостъпна услуга.",
  unknown: "Няма потвърдено състояние за всички основни услуги.",
};

export function StatusHero({ overall, lastCheckedAt, refreshing, refreshFailed = false, onRefresh }: StatusHeroProps) {
  const formatted = formatBulgarianDateTime(new Date(lastCheckedAt), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const refreshLabel = refreshing ? "Проверяваме..." : refreshFailed ? "Опитай отново" : "Опресни";

  return (
    <header className="status-hero" aria-label="Състояние на услугите">
      <div className="status-hero-art" aria-hidden="true" />
      <div className="status-hero-inner">
        <h1 className="status-hero-title">Състояние на услугите</h1>
        <p className="status-hero-status" role="status" data-overall={refreshFailed ? "unknown" : overall}>
          <span className="status-hero-dot" aria-hidden="true" />
          {refreshFailed ? "Текущото състояние не е потвърдено." : OVERALL_COPY[overall]}
        </p>
        <div className="status-hero-meta" data-overall={refreshFailed ? "unknown" : overall} data-stale={refreshFailed}>
          <span className="status-hero-meta-label">
            Последни данни от{" "}
            <time className="status-hero-time" dateTime={lastCheckedAt}>{formatted}</time>
          </span>
          <button
            type="button"
            className="status-hero-refresh"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label={refreshFailed ? "Опитай отново" : "Опресни състоянието сега"}
            aria-busy={refreshing}
            title={refreshLabel}
          >
            <RefreshCw size={16} aria-hidden="true" />
            <span>{refreshLabel}</span>
          </button>
        </div>
        {refreshFailed ? (
          <p className="status-hero-error" role="alert">
            Обновяването не успя. Показваме последните получени данни, които може вече да не са актуални.
          </p>
        ) : null}
      </div>
    </header>
  );
}
