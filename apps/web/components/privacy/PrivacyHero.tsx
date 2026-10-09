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
        <p className="privacy-hero-kicker">Сенките</p>
        <h1 className="privacy-hero-title">Поверителност</h1>
        <p className="privacy-hero-subtitle">
          Какви данни пазим, защо и как можеш да упражниш правата си.
          {hasSnapshot ? " С обобщение за твоето досие." : ""}
        </p>
        <p className="privacy-hero-meta">
          Последна актуализация: <time>{lastUpdated}</time>
        </p>
      </div>
    </header>
  );
}
