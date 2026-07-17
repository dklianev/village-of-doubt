import { SceneCard } from "@werewolf/ui/server";
import { ProfilePortrait } from "@/components/ProfilePortrait";
import styles from "./Account.module.css";

interface AccountHeroProps {
  userId: string;
  name: string;
  avatarId: string;
  memberSince: Date | null;
  totalGames: number;
  totalWins: number;
  winRate: number;
  activityState: "ready" | "empty" | "unavailable";
}

export function AccountHero(props: AccountHeroProps) {
  const memberSinceLabel = props.memberSince
    ? new Intl.DateTimeFormat("bg-BG", { year: "numeric", month: "long" }).format(props.memberSince)
    : null;

  return (
    <header className={styles.hero} aria-label="Досие" data-activity-state={props.activityState}>
      <SceneCard
        density="sm"
        background={{
          image: "var(--art-account)",
          overlay: "none",
          focalX: 54,
          focalY: 42,
          minHeight: "clamp(260px, 29vw, 340px)",
        }}
      >
        <div className={styles.heroInner}>
          <span className={styles.heroRegisterLines} aria-hidden="true" />
          <div
            className={styles.heroAvatar}
            role="img"
            aria-label={`Портрет на ${props.name || "играча"}`}
          >
            <ProfilePortrait avatarId={props.avatarId} decorative />
            <span className={styles.heroAvatarSeal} aria-hidden="true">ЛД</span>
          </div>

          <div className={styles.heroIdentity}>
            <p className={styles.heroKicker}>лично досие</p>
            <h1 className={styles.heroName}>{props.name || "Без име"}</h1>
            {memberSinceLabel ? <p className={styles.heroMeta}>Заведено: {memberSinceLabel}</p> : null}
            <p className={styles.heroFile}>Дело {shortFileNumber(props.userId)}</p>
          </div>

          {props.activityState === "ready" ? (
            <dl className={styles.heroQuickStats} aria-label="Обобщение на досието">
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
            <p className={styles.heroEmpty}>
              {props.activityState === "empty"
                ? "Първото дело още чака име."
                : "Игровите записи временно не са достъпни."}
            </p>
          )}
        </div>
      </SceneCard>
    </header>
  );
}

function shortFileNumber(userId: string) {
  let hash = 0;
  for (let index = 0; index < userId.length; index += 1) {
    hash = (Math.imul(hash, 31) + userId.charCodeAt(index)) >>> 0;
  }
  return `№ ${String(hash % 10_000).padStart(4, "0")}`;
}
