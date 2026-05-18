import { TermsAcceptance } from "./TermsAcceptance";
import { TermsCommitments } from "./TermsCommitments";
import { TermsConflict } from "./TermsConflict";
import { TermsHero } from "./TermsHero";
import { TermsLegalAnnex } from "./TermsLegalAnnex";

interface TermsCodexProps {
  lastUpdated: string;
  isAuthenticated: boolean;
  userName: string | null;
}

export function TermsCodex({ lastUpdated, isAuthenticated, userName }: TermsCodexProps) {
  return (
    <div className="terms-page">
      <TermsHero lastUpdated={lastUpdated} />

      <div className="terms-content">
        {isAuthenticated ? <TermsAcceptance userName={userName} /> : null}
        <TermsCommitments />
        <TermsConflict />
        <TermsLegalAnnex />
      </div>
    </div>
  );
}
