"use client";

import { useState } from "react";
import { Pill } from "@werewolf/ui/server";
import { Download } from "lucide-react";
import styles from "./Account.module.css";

import { downloadCompleteAccountExport } from "./account-export";

export function AccountDataExport() {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  async function exportData() {
    setExporting(true);
    setError("");

    try {
      await downloadCompleteAccountExport();
    } catch {
      setError("Не успяхме да подготвим данните. Опитай отново.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className={`${styles.archivePanel} ${styles.exportSection}`} id="account-data-export">
      <header className={styles.sectionHead}>
        <p className={styles.sectionKicker}>архивно копие</p>
        <h2>Твоите данни</h2>
        <p>Имаш право да изтеглиш всичко, което сме записали за теб.</p>
      </header>

      <Pill
        intent="secondary"
        size="lg"
        className={styles.exportButton}
        onClick={exportData}
        disabled={exporting}
        aria-busy={exporting}
      >
        <Download size={16} aria-hidden="true" />
        {exporting ? "Подготвяме данните..." : "Изтегли моите данни (JSON)"}
      </Pill>
      {error ? (
        <p className={`${styles.status} ${styles.statusError}`} role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
