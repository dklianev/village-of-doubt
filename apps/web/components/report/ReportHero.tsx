import Image from "next/image";
import { ShieldCheck } from "lucide-react";

export function ReportHero() {
  return (
    <header className="report-hero" aria-label="Сигнал">
      <div className="report-hero-banner">
        <Image
          src="/game-art/legal/report-banner.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="report-hero-img"
        />
        <div className="report-hero-scrim" aria-hidden />
        <div className="report-hero-beam" aria-hidden />
      </div>

      <div className="report-hero-inner">
        <p className="report-hero-kicker">сигнал</p>
        <h1 className="report-hero-title">Подай сигнал</h1>
        <p className="report-hero-subtitle">
          Разкажи ни за неуместно поведение, технически проблем или въпрос за твоите права.
        </p>
        <p className="report-hero-stat">
          <span className="report-hero-stat-icon" aria-hidden>
            <ShieldCheck size={18} />
          </span>
          <span>
            Сигналът не се публикува.
          </span>
        </p>
      </div>
    </header>
  );
}
