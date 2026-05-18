interface StatusSubscribeProps {
  discordUrl: string | null;
  telegramUrl: string | null;
}

export function StatusSubscribe({ discordUrl, telegramUrl }: StatusSubscribeProps) {
  return (
    <section className="status-section status-section-subscribe">
      <header className="status-section-head">
        <p className="status-section-kicker">получавай уведомления</p>
        <h2>Когато светлината мига.</h2>
        <p className="status-section-lede">
          За планирани прекъсвания и инциденти, които заслужават внимание.
        </p>
      </header>

      <div className="status-subscribe-grid">
        {discordUrl ? (
          <a
            href={discordUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="status-subscribe-card"
            data-channel="discord"
          >
            <MessageIcon />
            <span className="status-subscribe-label">Discord канал</span>
            <span className="status-subscribe-hint">Анонси, инциденти, общност.</span>
          </a>
        ) : (
          <div className="status-subscribe-card status-subscribe-card-pending" aria-disabled="true">
            <MessageIcon />
            <span className="status-subscribe-label">Discord канал</span>
            <span className="status-subscribe-hint">Скоро отворен.</span>
          </div>
        )}

        {telegramUrl ? (
          <a
            href={telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="status-subscribe-card"
            data-channel="telegram"
          >
            <SignalIcon />
            <span className="status-subscribe-label">Telegram канал</span>
            <span className="status-subscribe-hint">Кратки анонси без шум.</span>
          </a>
        ) : (
          <div className="status-subscribe-card status-subscribe-card-pending" aria-disabled="true">
            <SignalIcon />
            <span className="status-subscribe-label">Telegram канал</span>
            <span className="status-subscribe-hint">Скоро отворен.</span>
          </div>
        )}
      </div>
    </section>
  );
}

function MessageIcon() {
  return (
    <svg className="status-subscribe-icon" viewBox="0 0 32 32" fill="none" aria-hidden>
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
    <svg className="status-subscribe-icon" viewBox="0 0 32 32" fill="none" aria-hidden>
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
