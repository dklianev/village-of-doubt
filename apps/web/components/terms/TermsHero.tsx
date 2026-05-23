"use client";

import { Display, SceneCard } from "@werewolf/ui";

export function TermsHero({ lastUpdated }: { lastUpdated: string }) {
  return (
    <header
      aria-label="Кодекс на масата"
      style={{ maxWidth: "980px", margin: "0 auto", padding: "32px 24px 0" }}
    >
      <SceneCard eyebrow="КОДЕКС НА МАСАТА" density="lg">
        <Display size="h1">Сядаме на една маса.</Display>
        <p
          style={{
            color: "var(--ds-ink-scene-soft)",
            fontSize: "var(--ds-type-lede)",
            lineHeight: 1.55,
            margin: 0,
          }}
        >
          Правилата, които правят играта честна — за блъфа, за уважението, за чистата игра. Това не
          са юридически клопки, а обещания между играчи.
        </p>
        <p className="terms-hero-meta">
          Последна актуализация: <time>{lastUpdated}</time>
        </p>
      </SceneCard>
    </header>
  );
}
