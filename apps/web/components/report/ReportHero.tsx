import Image from "next/image";

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
        <h1 className="report-hero-title">Светим за тебе.</h1>
        <p className="report-hero-subtitle">
          Ако нещо не е наред — играч с неуместно поведение, спорно съдържание или нарушение на
          авторски права — кажи ни. Светилникът няма да угасне, докато не разгледаме.
        </p>
        <p className="report-hero-stat">
          <span className="report-hero-stat-icon" aria-hidden>
            ⏱
          </span>
          <span>
            Обикновено отговаряме в <strong>24-48 часа</strong>
          </span>
        </p>
      </div>
    </header>
  );
}
