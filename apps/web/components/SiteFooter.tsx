import Link from "next/link";
import styles from "./SiteFooter.module.css";

export function SiteFooter() {
  return (
    <footer className={`${styles.footer} site-footer`}>
      <div className={styles.links}>
        <Link href="/privacy" prefetch={false}>Поверителност</Link>
        <span aria-hidden>·</span>
        <Link href="/terms" prefetch={false}>Условия</Link>
        <span aria-hidden>·</span>
        <Link href="/report" prefetch={false}>Сигнал</Link>
        <span aria-hidden>·</span>
        <Link href="/status" prefetch={false}>Състояние</Link>
        <span aria-hidden>·</span>
        <Link href="/faq" prefetch={false}>Помощ</Link>
      </div>
      <p className={styles.tagline}>© {new Date().getFullYear()} Върколак и Мафия · Бета</p>
    </footer>
  );
}
