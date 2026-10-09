import Link from "next/link";
import { Masthead } from "./Masthead";

export function NewspaperEmpty() {
  return (
    <article className="newspaper-page newspaper-page-empty" data-state="empty" aria-label="Бъдещ брой">
      <Masthead />

      <div className="empty-headline">
        <p className="headline-kicker">главна новина</p>
        <h2 className="headline-main-title">Още няма класирани играчи</h2>
        <p className="empty-lede">За последните 7 дни няма резултати от публични завършени игри. Частните игри не участват в класацията.</p>
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
