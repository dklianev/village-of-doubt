import Image from "next/image";

export function TermsHero({ lastUpdated }: { lastUpdated: string }) {
  return (
    <header className="terms-hero" aria-label="Условия за ползване">
      <div className="terms-hero-banner">
        <Image
          src="/game-art/legal/terms-banner.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="terms-hero-img"
        />
        <div className="terms-hero-scrim" aria-hidden />
      </div>

      <div className="terms-hero-inner">
        <p className="terms-hero-kicker">Кодекс на масата</p>
        <h1 className="terms-hero-title">Условия за ползване</h1>
        <p className="terms-hero-subtitle">
          Правилата за участие в Сенките, условията за услугата и контакт при въпроси.
        </p>
        <p className="terms-hero-meta">
          Последна актуализация: <time>{lastUpdated}</time>
        </p>
      </div>
    </header>
  );
}
