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
      <p className="site-footer-tagline">© {new Date().getFullYear()} Върколак и Мафия · Бета</p>
    </footer>
  );
}
