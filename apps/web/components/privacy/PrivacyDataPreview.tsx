"use client";

import Link from "next/link";
import type { PrivacyUserSnapshot } from "./PrivacyDashboard";

interface PrivacyDataPreviewProps {
  snapshot: PrivacyUserSnapshot;
}

export function PrivacyDataPreview({ snapshot }: PrivacyDataPreviewProps) {
  const memberSinceLabel = snapshot.memberSince
    ? new Intl.DateTimeFormat("bg-BG", { day: "numeric", month: "long", year: "numeric" }).format(snapshot.memberSince)
    : "—";

  return (
    <section className="privacy-section privacy-section-preview">
      <header className="privacy-section-head">
        <p className="privacy-section-kicker">личен преглед</p>
        <h2>Какво виждаме за теб точно сега.</h2>
        <p className="privacy-section-lede">
          Това е целият списък с данни, които пазим за твоя профил. Нищо повече, нищо скрито.
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
            <span>Постижения</span>
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
        <a href="/api/account/export" className="privacy-data-action privacy-data-action-primary">
          <span>Изтегли всичките данни</span>
          <span className="privacy-data-action-hint">JSON файл със всичко, което знаем</span>
        </a>
      </div>

      <p className="privacy-data-disclaimer">
        Не виждаме твоя IP адрес след сесия, не пазим клавишни последователности, не четем чат
        съобщенията извън стаите на играта. Всичко, което показваме тук, можеш да изтеглиш или
        изтриеш по всяко време.
      </p>
    </section>
  );
}
