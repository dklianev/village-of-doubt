import styles from "./CookieBanner.module.css";

/** Shown only when the real banner fails to load; it informs without asking for consent. */
export function CookieNoticeFallback() {
  return (
    <div className={styles.slot}>
      <div className={styles.banner} role="region" aria-label="Бисквитки" data-cookie-banner>
        <p>
          Ползваме само необходими бисквитки за вход и сесия. Виж <a href="/privacy">политиката за поверителност</a>.
        </p>
      </div>
    </div>
  );
}
