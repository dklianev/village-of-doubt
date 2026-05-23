"use client";

import { Display, SceneCard } from "@werewolf/ui";

export function ReportHero() {
  return (
    <header
      aria-label="Сигнал"
      style={{ maxWidth: "980px", margin: "0 auto", padding: "32px 24px 0" }}
    >
      <SceneCard eyebrow="СИГНАЛ" density="lg">
        <Display size="h1">Светим за тебе.</Display>
        <p
          style={{
            color: "var(--ds-ink-scene-soft)",
            fontSize: "var(--ds-type-lede)",
            lineHeight: 1.55,
            margin: 0,
          }}
        >
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
      </SceneCard>
    </header>
  );
}
