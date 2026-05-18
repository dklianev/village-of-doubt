import Image from "next/image";

interface AccountHeroProps {
  name: string;
  image: string | null;
  memberSince: Date | null;
  totalGames: number;
  totalWins: number;
  winRate: number;
}

export function AccountHero(props: AccountHeroProps) {
  const initial = (props.name[0] ?? "?").toUpperCase();
  const memberSinceLabel = props.memberSince
    ? new Intl.DateTimeFormat("bg-BG", { year: "numeric", month: "long" }).format(props.memberSince)
    : null;

  return (
    <header className="account-hero" aria-label="Профил">
      <div className="account-hero-banner">
        <Image
          src="/game-art/account/account-hero-banner.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="account-hero-img"
        />
        <div className="account-hero-scrim" aria-hidden />
      </div>

      <div className="account-hero-inner">
        <div className="account-hero-avatar">
          {props.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={props.image} alt="" />
          ) : (
            <span className="account-hero-initial">{initial}</span>
          )}
        </div>

        <div className="account-hero-identity">
          <p className="account-hero-kicker">досие</p>
          <h1 className="account-hero-name">{props.name || "Без име"}</h1>
          {memberSinceLabel ? <p className="account-hero-meta">Член от {memberSinceLabel}</p> : null}
        </div>

        {props.totalGames > 0 ? (
          <dl className="account-hero-quickstats">
            <div>
              <dt>Игри</dt>
              <dd>{props.totalGames}</dd>
            </div>
            <div>
              <dt>Победи</dt>
              <dd>{props.totalWins}</dd>
            </div>
            <div>
              <dt>Процент</dt>
              <dd>{props.winRate}%</dd>
            </div>
          </dl>
        ) : (
          <p className="account-hero-empty">Първото дело още чака име.</p>
        )}
      </div>
    </header>
  );
}
