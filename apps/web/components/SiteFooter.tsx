import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-links">
        <Link href="/privacy">Поверителност</Link>
        <span aria-hidden>·</span>
        <Link href="/terms">Условия</Link>
        <span aria-hidden>·</span>
        <Link href="/report">Сигнал</Link>
        <span aria-hidden>·</span>
        <Link href="/status">Състояние</Link>
      </div>
      <p className="site-footer-credit">Върколак и Мафия · социална игра на сенки</p>
    </footer>
  );
}
