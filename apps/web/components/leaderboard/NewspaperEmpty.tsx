import Link from "next/link";

export function NewspaperEmpty() {
  return (
    <article className="newspaper-page newspaper-page-empty" data-state="empty" aria-label="Бъдещ брой">
      <header className="masthead">
        <h1 className="masthead-title">Вечерен Брой на Масата</h1>
        <p className="masthead-meta">Брой № 001 · очаква името си</p>
      </header>

      <div className="empty-headline">
        <p className="headline-kicker">главна новина</p>
        <h2 className="headline-main-title">Още няма класирани играчи</h2>
        <p className="empty-lede">Първата завършена игра ще отвори броя.</p>
        <div className="empty-press-proof" aria-hidden>
          <span className="empty-press-number">01</span>
          <span />
          <span />
          <span />
        </div>
        <div className="empty-cta">
          <Link href="/werewolf/create" className="btn btn-primary">
            Създай стая
          </Link>
          <Link href="/tutorial" className="btn btn-secondary">
            Първи стъпки
          </Link>
        </div>
      </div>
    </article>
  );
}
