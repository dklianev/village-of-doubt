import { AccountIdentity } from "./AccountIdentity";
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
  const memberSince = props.memberSince
    ? new Intl.DateTimeFormat("bg-BG", { year: "numeric", month: "long" }).format(props.memberSince)
    : null;
  return (
    <header className={styles.hero} aria-label="Досие" data-activity-state={props.activityState}>
      <div className={styles.heroInner}>
        <AccountIdentity name={props.name} avatarId={props.avatarId} memberSince={memberSince} />
        {props.activityState === "ready" ? (
          <dl className={styles.heroQuickStats} aria-label="Обобщение на досието">
            <div><dt>Игри</dt><dd>{props.totalGames}</dd></div>
            <div><dt>Победи</dt><dd>{props.totalWins}</dd></div>
            <div><dt>Успеваемост</dt><dd>{props.winRate}%</dd></div>
          </dl>
        ) : (
          <p className={styles.heroEmpty}>
            {props.activityState === "empty" ? "Първата ти вечер предстои." : "Игровите записи временно не са достъпни."}
          </p>
        )}
      </div>
    </header>
  );
}
