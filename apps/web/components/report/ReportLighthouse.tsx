"use client";

import { ReportHero } from "./ReportHero";
import { ReportWizard } from "./ReportWizard";

interface ReportLighthouseProps {
  userEmail: string | null;
  userName: string | null;
}

export function ReportLighthouse({ userEmail, userName }: ReportLighthouseProps) {
  return (
    <div className="report-page">
      <ReportHero />
      <div className="report-content">
        <ReportWizard userEmail={userEmail} userName={userName} />
      </div>
    </div>
  );
}
