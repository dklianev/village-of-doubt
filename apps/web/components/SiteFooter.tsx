import Link from "next/link";
import styles from "./SiteFooter.module.css";

export function SiteFooter() {
  return (
    <footer className={`${styles.footer} site-footer`}>
      <div className={styles.links}>
        <Link href="/privacy">Поверителност</Link>
        <span aria-hidden>·</span>
        <Link href="/terms">Условия</Link>
        <span aria-hidden>·</span>
        <Link href="/report">Сигнал</Link>
        <span aria-hidden>·</span>
        <Link href="/status">Състояние</Link>
        <span aria-hidden>·</span>
        <Link href="/faq">Помощ</Link>
      </div>
      <p className={styles.tagline}>© {new Date().getFullYear()} Върколак и Мафия · Бета</p>
    </footer>
  );
}
