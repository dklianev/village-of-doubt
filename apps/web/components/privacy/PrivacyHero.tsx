import Image from "next/image";

interface PrivacyHeroProps {
  lastUpdated: string;
  hasSnapshot: boolean;
}

export function PrivacyHero({ lastUpdated, hasSnapshot }: PrivacyHeroProps) {
  return (
    <header className="privacy-hero" aria-label="Политика за поверителност">
      <div className="privacy-hero-banner" style={{ position: "absolute", inset: 0 }}>
        <Image
          src="/game-art/legal/privacy-banner.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="privacy-hero-img"
        />
        <div className="privacy-hero-scrim" aria-hidden />
      </div>

      <div className="privacy-hero-inner">
        <p className="privacy-hero-kicker">политика за поверителност</p>
        <h1 className="privacy-hero-title">Твоите тайни остават при теб.</h1>
        <p className="privacy-hero-subtitle">
          Какво събираме, защо го пазим и как си господар на твоите данни.
          {hasSnapshot ? " По-долу виждаш точно какво знаем за теб." : ""}
        </p>
        <p className="privacy-hero-meta">
          Последна актуализация: <time>{lastUpdated}</time>
        </p>
      </div>
    </header>
  );
}
