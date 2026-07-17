"use client";

import { useState } from "react";
import { Pill } from "@werewolf/ui/server";
import styles from "./Account.module.css";

type ReadableStorage = Pick<Storage, "getItem">;

export interface AccountExportSettings {
  theme: "dark" | "light" | null;
  soundEnabled: boolean | null;
  cueMode: "silent" | "visual" | "audio_vibration" | null;
  lastGameFamily: "werewolves" | "mafia" | null;
}

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
        shimmer
        className={styles.exportButton}
        onClick={exportData}
        disabled={exporting}
        aria-busy={exporting}
      >
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

export async function downloadCompleteAccountExport(storage: ReadableStorage | null = getBrowserStorage()) {
  const response = await fetch("/api/account/export", {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error("export_failed");
  }

  const serverExport = (await response.json()) as unknown;
  const exportData = buildCompleteAccountExport(serverExport, storage);
  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const objectUrl = URL.createObjectURL(blob);
  const download = document.createElement("a");
  download.href = objectUrl;
  download.download = downloadFilename(response.headers.get("content-disposition"));
  download.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

export function buildCompleteAccountExport(serverExport: unknown, storage: ReadableStorage | null) {
  if (!serverExport || typeof serverExport !== "object" || Array.isArray(serverExport)) {
    throw new Error("invalid_account_export");
  }

  return {
    ...(serverExport as Record<string, unknown>),
    settings: readAccountExportSettings(storage),
  };
}

export function readAccountExportSettings(storage: ReadableStorage | null): AccountExportSettings {
  const theme = storage?.getItem("werewolf-theme");
  const sound = storage?.getItem("werewolf-sound");
  const cueMode = storage?.getItem("werewolf-cue-mode");
  const lastGameFamily = storage?.getItem("last-family");

  return {
    theme: theme === "dark" || theme === "light" ? theme : null,
    soundEnabled: sound === "on" ? true : sound === "off" ? false : null,
    cueMode:
      cueMode === "silent" || cueMode === "visual" || cueMode === "audio_vibration" ? cueMode : null,
    lastGameFamily: lastGameFamily === "werewolves" || lastGameFamily === "mafia" ? lastGameFamily : null,
  };
}

function getBrowserStorage(): ReadableStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function downloadFilename(contentDisposition: string | null) {
  const match = contentDisposition?.match(/filename="([^"]+)"/i);
  return match?.[1] ?? `werewolf-mafia-export-${Date.now()}.json`;
}
