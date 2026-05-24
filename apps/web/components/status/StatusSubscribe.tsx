import styles from "./Status.module.css";

interface StatusSubscribeProps {
  discordUrl: string | null;
  telegramUrl: string | null;
}

export function StatusSubscribe({ discordUrl, telegramUrl }: StatusSubscribeProps) {
  return (
    <section id="status-subscribe" className={styles.section}>
      <header className={styles.sectionHead}>
        <p className={styles.sectionKicker}>получавай уведомления</p>
        <h2>Когато светлината мига.</h2>
        <p className={styles.sectionLede}>
          За планирани прекъсвания и инциденти, които заслужават внимание.
        </p>
      </header>

      <div className={styles.subscribeGrid}>
        {discordUrl ? (
          <a
            href={discordUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.subscribeCard}
            data-channel="discord"
          >
            <MessageIcon />
            <span className={styles.subscribeLabel}>Discord канал</span>
            <span className={styles.subscribeHint}>Анонси, инциденти, общност.</span>
          </a>
        ) : (
          <div className={`${styles.subscribeCard} ${styles.subscribeCardPending}`} aria-disabled="true">
            <MessageIcon />
            <span className={styles.subscribeLabel}>Discord канал</span>
            <span className={styles.subscribeHint}>Скоро отворен.</span>
          </div>
        )}

        {telegramUrl ? (
          <a
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.subscribeCard}
            data-channel="telegram"
          >
            <SignalIcon />
            <span className={styles.subscribeLabel}>Telegram канал</span>
            <span className={styles.subscribeHint}>Кратки анонси без шум.</span>
          </a>
        ) : (
          <div className={`${styles.subscribeCard} ${styles.subscribeCardPending}`} aria-disabled="true">
            <SignalIcon />
            <span className={styles.subscribeLabel}>Telegram канал</span>
            <span className={styles.subscribeHint}>Скоро отворен.</span>
          </div>
        )}
      </div>
    </section>
  );
}

function MessageIcon() {
  return (
    <svg className={styles.subscribeIcon} viewBox="0 0 32 32" fill="none" aria-hidden>
      <path
        d="M6 8h20v13H12l-6 5V8Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M11 13h10M11 17h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function SignalIcon() {
  return (
    <svg className={styles.subscribeIcon} viewBox="0 0 32 32" fill="none" aria-hidden>
      <path
        d="M16 25a9 9 0 0 0 9-9M16 21a5 5 0 0 0 5-5M16 17a1 1 0 0 0 1-1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="m5 17 22-10-7 20-5-7-7 4 3-8-6 1Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
