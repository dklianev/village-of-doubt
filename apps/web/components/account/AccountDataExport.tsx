"use client";

export function AccountDataExport() {
  function exportData() {
    window.location.href = "/api/account/export";
  }

  return (
    <section className="account-section">
      <header className="account-section-head">
        <h2>Твоите данни</h2>
        <p>Имаш право да изтеглиш всичко, което сме записали за теб.</p>
      </header>

      <button type="button" className="account-export-btn" onClick={exportData}>
        Изтегли моите данни (JSON)
      </button>
    </section>
  );
}
