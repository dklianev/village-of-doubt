import { PrivacyDataPreview } from "./PrivacyDataPreview";
import { PrivacyHero } from "./PrivacyHero";
import { PrivacyPromiseWall } from "./PrivacyPromiseWall";
import { PrivacyRights } from "./PrivacyRights";
import { PrivacySections } from "./PrivacySections";
import { PrivacyVersionHistory } from "./PrivacyVersionHistory";
import { LegalReturnLink } from "../legal/LegalReturnLink";

export interface PrivacyUserSnapshot {
  name: string;
  email: string;
  emailVerified: boolean;
  memberSince: Date | null;
  totalGames: number | null;
  totalAchievements: number | null;
  achievementTotal: number;
  providersUsed: number | null;
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
        <nav id="privacy-contents" tabIndex={-1} className="privacy-navigation" aria-label="Съдържание на политиката">
          <a href="#privacy-rights">Права и действия</a>
          {userSnapshot ? <a href="#privacy-data">Моите данни</a> : null}
          <a href="#what-and-why">Какви данни</a>
          <a href="#sharing">Споделяне</a>
          <a href="#retention">Срокове</a>
          <a href="#cookies">Бисквитки</a>
          <a href="#children">Деца</a>
          <a href="#privacy-promises">Обещания</a>
        </nav>

        <PrivacyRights />
        <LegalReturnLink page="privacy" />

        {userSnapshot ? <PrivacyDataPreview snapshot={userSnapshot} /> : null}

        <PrivacyPromiseWall />
        <LegalReturnLink page="privacy" />

        <PrivacySections />

        <PrivacyVersionHistory />
        <LegalReturnLink page="privacy" />
      </div>
    </div>
  );
}
