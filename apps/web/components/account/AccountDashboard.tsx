import type { ReactNode } from "react";

import { AccountAchievements } from "./AccountAchievements";
import { AccountDangerZone } from "./AccountDangerZone";
import { AccountDataExport } from "./AccountDataExport";
import { AccountHero } from "./AccountHero";
import { AccountProfile } from "./AccountProfile";
import { AccountRecentGames, type RecentGameSummary } from "./AccountRecentGames";
import { AccountStats } from "./AccountStats";
import styles from "./Account.module.css";
import type { PlayerStats } from "@/lib/account-stats";

interface AccountDashboardProps {
  userId: string;
  email: string;
  name: string;
  avatarId: string;
  emailVerified: boolean;
  providers: string[];
  activityState: "ready" | "empty" | "unavailable";
  stats: PlayerStats;
  recentGames: RecentGameSummary[];
  unlockedAchievementIds: string[];
  totalAchievementCount: number;
}

export function AccountDashboard(props: AccountDashboardProps) {
  return (
    <div className={styles.page} data-activity-state={props.activityState}>
      <AccountHero
        userId={props.userId}
        name={props.name}
        avatarId={props.avatarId}
        memberSince={props.stats.memberSince}
        totalGames={props.stats.totalGames}
        totalWins={props.stats.totalWins}
        winRate={props.stats.winRate}
        activityState={props.activityState}
      />

      <div className={styles.content}>
        <AccountGroup
          id="chronicle"
          index="I"
          title="Хроника"
          description="Статистика, легенди и последни игри"
          defaultChecked
        >
          {props.activityState !== "unavailable" ? (
            <AccountStats stats={props.stats} activityState={props.activityState} />
          ) : null}

          {props.activityState === "unavailable" ? <AccountActivityUnavailable /> : null}

          {props.activityState !== "unavailable" ? (
            <AccountAchievements unlockedIds={props.unlockedAchievementIds} total={props.totalAchievementCount} />
          ) : null}

          {props.activityState === "ready" && props.recentGames.length > 0 ? (
            <AccountRecentGames games={props.recentGames} />
          ) : null}
        </AccountGroup>

        <AccountGroup
          id="identity"
          index="II"
          title="Образ и достъп"
          description="Име, портрет и свързани профили"
        >
          <AccountProfile
            initialName={props.name}
            initialAvatarId={props.avatarId}
            email={props.email}
            emailVerified={props.emailVerified}
            providers={props.providers}
          />
        </AccountGroup>

        <AccountGroup
          id="security"
          index="III"
          title="Данни и сигурност"
          description="Архив и управление на досието"
        >
          <div className={styles.archiveActions} data-account-archive-actions>
            <AccountDataExport />
            <AccountDangerZone email={props.email} />
          </div>
        </AccountGroup>
      </div>
    </div>
  );
}

function AccountGroup({
  id,
  index,
  title,
  description,
  defaultChecked = false,
  children,
}: {
  id: string;
  index: string;
  title: string;
  description: string;
  defaultChecked?: boolean;
  children: ReactNode;
}) {
  const inputId = `account-section-${id}`;

  return (
    <div className={styles.accountGroup} data-account-section={id}>
      <input
        className={styles.accountGroupToggle}
        type="radio"
        name="account-section"
        id={inputId}
        aria-label={title}
        defaultChecked={defaultChecked}
      />
      <label className={styles.accountGroupSummary} htmlFor={inputId}>
        <span className={styles.accountGroupIndex}>{index}</span>
        <span className={styles.accountGroupLabel}>
          <strong>{title}</strong>
          <small>{description}</small>
        </span>
      </label>
      <div className={styles.accountGroupBody}>{children}</div>
    </div>
  );
}

function AccountActivityUnavailable() {
  return (
    <section className={`${styles.section} ${styles.unavailableSection}`} role="alert">
      <header className={styles.sectionHead}>
        <p className={styles.sectionKicker}>временно запечатано</p>
        <h2>Игровите записи не са достъпни</h2>
        <p>Профилът ти е зареден, но статистиката и легендите не могат да бъдат прочетени в момента.</p>
      </header>
      <p className={styles.emptyNote}>Опитай отново след малко. Няма изгубени или занулени данни.</p>
    </section>
  );
}
