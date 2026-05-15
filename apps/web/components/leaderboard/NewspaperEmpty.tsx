import Link from "next/link";

export function NewspaperEmpty() {
  return (
    <article className="newspaper-page newspaper-page-empty" aria-label="Бъдещ брой">
      <header className="masthead">
        <h1 className="masthead-title">Вечерен Брой на Масата</h1>
        <p className="masthead-meta">Брой № 001 · очаква името си</p>
      </header>

      <div className="empty-headline">
        <p className="headline-kicker">главна новина</p>
        <h2 className="headline-main-title">Изданието още не е тиражирано</h2>
        <p className="empty-lede">Утрешният брой ще носи първото име. Завърши една игра и редакцията се събужда.</p>
        <div className="empty-cta">
          <Link href="/werewolf/create" className="btn btn-primary">
            Започни първото издание
          </Link>
          <Link href="/tutorial" className="btn btn-secondary">
            Виж как изглежда вечер
          </Link>
        </div>
      </div>
    </article>
  );
}
