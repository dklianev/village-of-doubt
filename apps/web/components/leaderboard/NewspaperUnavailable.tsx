import Link from "next/link";

export function NewspaperUnavailable() {
  return (
    <article
      className="newspaper-page newspaper-page-empty"
      data-state="unavailable"
      aria-label="Недостъпен вечерен брой"
      role="alert"
    >
      <header className="masthead">
        <h1 className="masthead-title">Вечерен Брой на Масата</h1>
        <p className="masthead-meta">Редакцията временно е затворена</p>
      </header>

      <div className="empty-headline">
        <p className="headline-kicker">извънредно съобщение</p>
        <h2 className="headline-main-title">Класацията временно е недостъпна</h2>
        <p className="empty-lede">
          Не успяхме да заредим резултатите. Опитай отново след малко.
        </p>
        <div className="empty-cta">
          <Link href="/leaderboard" className="btn btn-primary">
            Опитай отново
          </Link>
          <Link href="/" className="btn btn-secondary">
            Към началото
          </Link>
        </div>
      </div>
    </article>
  );
}
