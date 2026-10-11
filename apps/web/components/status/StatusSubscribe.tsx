import { MessageCircle, Send } from "lucide-react";

interface StatusSubscribeProps {
  discordUrl: string | null;
  telegramUrl: string | null;
}

export function StatusSubscribe({ discordUrl, telegramUrl }: StatusSubscribeProps) {
  const discord = publicChannelUrl(discordUrl);
  const telegram = publicChannelUrl(telegramUrl);
  if (!discord && !telegram) return null;

  return (
    <section id="status-subscribe" className="status-section status-section-subscribe">
      <header className="status-section-head">
        <h2>Общност</h2>
      </header>

      <div className="status-subscribe-grid">
        {discord ? (
          <a
            href={discord}
            target="_blank"
            rel="noopener noreferrer"
            className="status-subscribe-card"
            data-channel="discord"
          >
            <MessageCircle className="status-subscribe-icon" size={24} aria-hidden="true" />
            <span className="status-subscribe-label">Discord канал</span>
          </a>
        ) : null}

        {telegram ? (
          <a
            href={telegram}
            target="_blank"
            rel="noopener noreferrer"
            className="status-subscribe-card"
            data-channel="telegram"
          >
            <Send className="status-subscribe-icon" size={24} aria-hidden="true" />
            <span className="status-subscribe-label">Telegram канал</span>
          </a>
        ) : null}
      </div>
    </section>
  );
}

function publicChannelUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
