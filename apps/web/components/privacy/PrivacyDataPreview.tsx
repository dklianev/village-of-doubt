"use client";

import Link from "next/link";
import { useState } from "react";
import { downloadCompleteAccountExport } from "@/components/account/AccountDataExport";
import type { PrivacyUserSnapshot } from "./PrivacyDashboard";

interface PrivacyDataPreviewProps {
  snapshot: PrivacyUserSnapshot;
}

export function PrivacyDataPreview({ snapshot }: PrivacyDataPreviewProps) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const memberSinceLabel = snapshot.memberSince
    ? new Intl.DateTimeFormat("bg-BG", { day: "numeric", month: "long", year: "numeric" }).format(snapshot.memberSince)
    : "—";

  async function exportData() {
    setExporting(true);
    setExportError("");
    try {
      await downloadCompleteAccountExport();
    } catch {
      setExportError("Не успяхме да подготвим данните. Опитай отново.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="privacy-section privacy-section-preview">
      <header className="privacy-section-head">
        <p className="privacy-section-kicker">личен преглед</p>
        <h2>Какво виждаме за теб точно сега.</h2>
        <p className="privacy-section-lede">
          Това е целият списък с данни, които пазим за твоето досие. Нищо повече, нищо скрито.
        </p>
      </header>

      <dl className="privacy-data-list">
        <div className="privacy-data-row">
          <dt>
            <span className="privacy-data-icon" aria-hidden>
              @
            </span>
            <span>Имейл адрес</span>
          </dt>
          <dd>
            <code>{snapshot.email}</code>
            {snapshot.emailVerified ? (
              <span className="privacy-data-badge privacy-data-badge-ok">потвърден</span>
            ) : (
              <Link href="/verify-email" className="privacy-data-badge privacy-data-badge-warn">
                непотвърден →
              </Link>
            )}
          </dd>
        </div>

        <div className="privacy-data-row">
          <dt>
            <span className="privacy-data-icon" aria-hidden>
              И
            </span>
            <span>Име на масата</span>
          </dt>
          <dd>
            <code>{snapshot.name || "—"}</code>
            <Link href="/account" className="privacy-data-edit">
              Промени →
            </Link>
          </dd>
        </div>

        <div className="privacy-data-row">
          <dt>
            <span className="privacy-data-icon" aria-hidden>
              #
            </span>
            <span>Игрова история</span>
          </dt>
          <dd>
            <code>
              {snapshot.totalGames === 0
                ? "още няма"
                : `${snapshot.totalGames} ${snapshot.totalGames === 1 ? "игра" : "игри"}`}
            </code>
            <Link href="/history" className="privacy-data-edit">
              Виж архива →
            </Link>
          </dd>
        </div>

        <div className="privacy-data-row">
          <dt>
            <span className="privacy-data-icon" aria-hidden>
              ★
            </span>
            <span>Легенди</span>
          </dt>
          <dd>
            <code>
              {snapshot.totalAchievements} от {snapshot.achievementTotal} отключени
            </code>
            <Link href="/achievements" className="privacy-data-edit">
              Виж всички →
            </Link>
          </dd>
        </div>

        <div className="privacy-data-row">
          <dt>
            <span className="privacy-data-icon" aria-hidden>
              ◷
            </span>
            <span>Регистриран</span>
          </dt>
          <dd>
            <code>{memberSinceLabel}</code>
            <span className="privacy-data-badge">{snapshot.providersUsed} входа</span>
          </dd>
        </div>
      </dl>

      <div className="privacy-data-actions">
        <button
          type="button"
          className="privacy-data-action privacy-data-action-primary"
          onClick={exportData}
          disabled={exporting}
          aria-busy={exporting}
        >
          <span>{exporting ? "Подготвяме данните..." : "Изтегли всичките данни"}</span>
          <span className="privacy-data-action-hint">JSON файл със всичко, което знаем</span>
        </button>
      </div>
      {exportError ? <p className="privacy-export-error" role="alert">{exportError}</p> : null}

      <p className="privacy-data-disclaimer">
        Не виждаме твоя IP адрес след сесия, не пазим клавишни последователности и не четем
        съобщения от разговорите извън стаите на играта. Всичко, което показваме тук, можеш да изтеглиш или
        изтриеш по всяко време.
      </p>
    </section>
  );
}
