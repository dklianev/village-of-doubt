import Image from "next/image";
import { Display } from "@werewolf/ui/server";
import { flavorQuoteFor, headlineFor, winRatePercent, type LeaderboardEntry } from "@/lib/leaderboard-headlines";

export function MainHeadline({ entry }: { entry: LeaderboardEntry }) {
  const headline = headlineFor(entry, 1);
  const quote = flavorQuoteFor(entry, 1);

  return (
    <section className="headline-main" aria-label="Главна новина">
      <p className="headline-kicker">главна новина</p>
      <div className="headline-main-title">
        <Display size="h2" as="h2">
          {headline}
        </Display>
      </div>

      <div className="headline-main-grid">
        <figure className="headline-portrait">
          <Image
            src="/game-art/leaderboard-headline-portrait.webp"
            alt=""
            width={512}
            height={683}
            sizes="(max-width: 768px) 70vw, 512px"
            priority
            className="headline-portrait-img"
          />
          <figcaption className="headline-portrait-caption">«Силуетът, който масата вече разпознава.»</figcaption>
        </figure>

        <div className="headline-body">
          {quote ? (
            <p className="headline-lede">
              <span className="headline-dropcap">{quote.charAt(0)}</span>
              {quote.slice(1)}
            </p>
          ) : null}

          <dl className="headline-stats">
            <div>
              <dt>Вечери</dt>
              <dd>{entry.games}</dd>
            </div>
            <div>
              <dt>Победи</dt>
              <dd>{entry.wins}</dd>
            </div>
            <div>
              <dt>Процент</dt>
              <dd>{winRatePercent(entry)}%</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
