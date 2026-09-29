"use client";

import Link from "next/link";
import { useState } from "react";
import { downloadCompleteAccountExport } from "@/components/account/account-export";
import { formatBulgarianDateTime } from "@/lib/date-time";
import type { PrivacyUserSnapshot } from "./PrivacyDashboard";

interface PrivacyDataPreviewProps {
  snapshot: PrivacyUserSnapshot;
}

export function PrivacyDataPreview({ snapshot }: PrivacyDataPreviewProps) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const memberSinceLabel = snapshot.memberSince && Number.isFinite(snapshot.memberSince.getTime())
    ? formatBulgarianDateTime(snapshot.memberSince, { day: "numeric", month: "long", year: "numeric" })
    : "Няма налична дата";

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
    <section id="privacy-data" tabIndex={-1} className="privacy-section privacy-section-preview">
      <header className="privacy-section-head">
        <p className="privacy-section-kicker">личен преглед</p>
        <h2>Обобщение на твоите данни.</h2>
        <p className="privacy-section-lede">
          Основни данни за досието ти и завършените игри, в които си участвал.
          За повече подробности можеш да изтеглиш копие на данните си.
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
            <Link href="/account#account-identity" className="privacy-data-edit">
              Промени →
            </Link>
          </dd>
        </div>

        <div className="privacy-data-row">
          <dt>
            <span className="privacy-data-icon" aria-hidden>
              #
            </span>
            <span>Завършени игри</span>
          </dt>
          <dd>
            <code>
              {snapshot.totalGames === null
                ? "Временно недостъпни"
                : snapshot.totalGames === 0
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
              {snapshot.totalAchievements === null
                ? "Временно недостъпни"
                : `${snapshot.totalAchievements} от ${snapshot.achievementTotal} отключени`}
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
          </dd>
        </div>
        <div className="privacy-data-row">
          <dt>Свързани начини за вход</dt>
          <dd>
            <code>{snapshot.providersUsed === null ? "Временно недостъпни" : snapshot.providersUsed}</code>
          </dd>
        </div>
      </dl>

      {snapshot.totalGames === null || snapshot.totalAchievements === null || snapshot.providersUsed === null ? (
        <p className="privacy-data-unavailable" role="status">
          Част от данните временно не могат да се заредят. Това не означава, че липсват. Опитай отново по-късно.
        </p>
      ) : null}

      <div className="privacy-data-actions">
        <button
          type="button"
          className="privacy-data-action privacy-data-action-primary"
          onClick={exportData}
          disabled={exporting}
          aria-busy={exporting}
        >
          <span>{exporting ? "Подготвяме данните..." : "Изтегли моите данни"}</span>
          <span className="privacy-data-action-hint">Копие на данните в JSON файл</span>
        </button>
      </div>
      {exportError ? <p className="privacy-export-error" role="alert">{exportError}</p> : null}

      <p className="privacy-data-disclaimer">
        Тук виждаш обобщение на данните си. За пълното копие използвай „Изтегли моите данни“,
        а за промяна или изтриване отвори досието си.
      </p>
    </section>
  );
}
