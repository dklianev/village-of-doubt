"use client";

import { Display, SceneCard } from "@werewolf/ui";

interface PrivacyHeroProps {
  lastUpdated: string;
  hasSnapshot: boolean;
}

export function PrivacyHero({ lastUpdated, hasSnapshot }: PrivacyHeroProps) {
  return (
    <header
      aria-label="Политика за поверителност"
      style={{ maxWidth: "980px", margin: "0 auto", padding: "32px 24px 0" }}
    >
      <SceneCard eyebrow="ПОЛИТИКА ЗА ПОВЕРИТЕЛНОСТ" density="lg">
        <Display size="h1">Твоите тайни остават при теб.</Display>
        <p
          style={{
            color: "var(--ds-ink-scene-soft)",
            fontSize: "var(--ds-type-lede)",
            lineHeight: 1.55,
            margin: 0,
          }}
        >
          Какво събираме, защо го пазим и как си господар на твоите данни.
          {hasSnapshot ? " По-долу виждаш точно какво знаем за теб." : ""}
        </p>
        <p className="privacy-hero-meta">
          Последна актуализация: <time>{lastUpdated}</time>
        </p>
      </SceneCard>
    </header>
  );
}
