import { TermsAcceptance } from "./TermsAcceptance";
import { TermsCommitments } from "./TermsCommitments";
import { TermsConflict } from "./TermsConflict";
import { TermsHero } from "./TermsHero";
import { TermsLegalAnnex, TermsContents } from "./TermsLegalAnnex";
import { LegalReturnLink } from "../legal/LegalReturnLink";

interface TermsCodexProps {
  lastUpdated: string;
}

export function TermsCodex({ lastUpdated }: TermsCodexProps) {
  return (
    <div className="terms-page">
      <TermsHero lastUpdated={lastUpdated} />

      <div className="terms-content">
        <TermsContents />
        <TermsCommitments />
        <LegalReturnLink page="terms" />
        <TermsConflict />
        <LegalReturnLink page="terms" />
        <TermsLegalAnnex />
        <TermsAcceptance />
        <LegalReturnLink page="terms" />
      </div>
    </div>
  );
}
