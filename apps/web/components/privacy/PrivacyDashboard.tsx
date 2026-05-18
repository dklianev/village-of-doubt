import { PrivacyDataPreview } from "./PrivacyDataPreview";
import { PrivacyHero } from "./PrivacyHero";
import { PrivacyPromiseWall } from "./PrivacyPromiseWall";
import { PrivacyRights } from "./PrivacyRights";
import { PrivacySections } from "./PrivacySections";
import { PrivacyVersionHistory } from "./PrivacyVersionHistory";

export interface PrivacyUserSnapshot {
  userId: string;
  name: string;
  email: string;
  emailVerified: boolean;
  memberSince: Date | null;
  totalGames: number;
  totalAchievements: number;
  achievementTotal: number;
  providersUsed: number;
}

interface PrivacyDashboardProps {
  lastUpdated: string;
  userSnapshot: PrivacyUserSnapshot | null;
}

export function PrivacyDashboard({ lastUpdated, userSnapshot }: PrivacyDashboardProps) {
  return (
    <div className="privacy-page">
      <PrivacyHero lastUpdated={lastUpdated} hasSnapshot={Boolean(userSnapshot)} />

      <div className="privacy-content">
        {userSnapshot ? <PrivacyDataPreview snapshot={userSnapshot} /> : null}

        <PrivacyPromiseWall />

        <PrivacySections />

        <PrivacyRights />

        <PrivacyVersionHistory />
      </div>
    </div>
  );
}
