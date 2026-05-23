"use client";

import { Display, PaperCard } from "@werewolf/ui/server";

export function AccountDataExport() {
  function exportData() {
    window.location.href = "/api/account/export";
  }

  return (
    <section aria-labelledby="account-data-title">
      <PaperCard eyebrow="ТВОИТЕ ДАННИ" density="md">
        <div className="account-card-content">
          <header className="account-section-head">
            <Display size="h3" as="h2">
              <span id="account-data-title">Твоите данни</span>
            </Display>
            <p>Имаш право да изтеглиш всичко, което сме записали за теб.</p>
          </header>

          <button type="button" className="account-export-btn" onClick={exportData}>
            Изтегли моите данни (JSON)
          </button>
        </div>
      </PaperCard>
    </section>
  );
}
