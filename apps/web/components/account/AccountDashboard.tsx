"use client";

import { AccountAchievements } from "./AccountAchievements";
import { AccountDangerZone } from "./AccountDangerZone";
import { AccountDataExport } from "./AccountDataExport";
import { AccountHero } from "./AccountHero";
import { AccountProfile } from "./AccountProfile";
import { AccountRecentGames, type RecentGameSummary } from "./AccountRecentGames";
import { AccountStats } from "./AccountStats";
import type { PlayerStats } from "@/lib/account-stats";

interface AccountDashboardProps {
  userId: string;
  email: string;
  name: string;
  image: string | null;
  emailVerified: boolean;
  providers: string[];
  stats: PlayerStats;
  recentGames: RecentGameSummary[];
  unlockedAchievementIds: string[];
  totalAchievementCount: number;
}

export function AccountDashboard(props: AccountDashboardProps) {
  return (
    <div className="account-page">
      <AccountHero
        name={props.name}
        image={props.image}
        memberSince={props.stats.memberSince}
        totalGames={props.stats.totalGames}
        totalWins={props.stats.totalWins}
        winRate={props.stats.winRate}
      />

      <div className="account-content">
        {props.stats.totalGames > 0 ? <AccountStats stats={props.stats} /> : null}

        <AccountAchievements unlockedIds={props.unlockedAchievementIds} total={props.totalAchievementCount} />

        {props.recentGames.length > 0 ? <AccountRecentGames games={props.recentGames} /> : null}

        <AccountProfile
          initialName={props.name}
          email={props.email}
          emailVerified={props.emailVerified}
          providers={props.providers}
        />

        <AccountDataExport />

        <AccountDangerZone />
      </div>
    </div>
  );
}
