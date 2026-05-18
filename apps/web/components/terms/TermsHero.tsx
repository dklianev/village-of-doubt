import Image from "next/image";

export function TermsHero({ lastUpdated }: { lastUpdated: string }) {
  return (
    <header className="terms-hero" aria-label="Кодекс на масата">
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
        <p className="terms-hero-kicker">кодекс на масата</p>
        <h1 className="terms-hero-title">Сядаме на една маса.</h1>
        <p className="terms-hero-subtitle">
          Правилата, които правят играта честна — за блъфа, за уважението, за чистата игра. Това не
          са юридически клопки, а обещания между играчи.
        </p>
        <p className="terms-hero-meta">
          Последна актуализация: <time>{lastUpdated}</time>
        </p>
      </div>
    </header>
  );
}
