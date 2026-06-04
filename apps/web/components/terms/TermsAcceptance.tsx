"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "terms-accepted-version";
const CURRENT_VERSION = "2026-05-19";

interface TermsAcceptanceProps {
  userName: string | null;
}

export function TermsAcceptance({ userName }: TermsAcceptanceProps) {
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);
  const [justAccepted, setJustAccepted] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored) as { version?: string; acceptedAt?: string };
      if (parsed.version === CURRENT_VERSION && parsed.acceptedAt) {
        setAcceptedAt(parsed.acceptedAt);
      }
    } catch {
      // Local acceptance is decorative UX, so malformed data is ignored.
    }
  }, []);

  function accept() {
    const now = new Date().toISOString();
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: CURRENT_VERSION, acceptedAt: now }),
    );
    setAcceptedAt(now);
    setJustAccepted(true);
    window.setTimeout(() => setJustAccepted(false), 3500);
  }

  const formattedDate = acceptedAt
    ? new Intl.DateTimeFormat("bg-BG", { dateStyle: "long" }).format(new Date(acceptedAt))
    : null;

  return (
    <section className="terms-section terms-section-acceptance">
      <header className="terms-section-head">
        <p className="terms-section-kicker">подпис на масата</p>
        <h2>{userName ? `${userName}, прочете ли кодекса?` : "Прочете ли кодекса?"}</h2>
        <p className="terms-section-lede">
          Като играеш, ти приемаш правилата по подразбиране. Този подпис е символичен — показва, че
          съзнателно си се запознал с обещанията на масата.
        </p>
      </header>

      <div className="terms-acceptance-body">
        {acceptedAt ? (
          <div className="terms-acceptance-state terms-acceptance-state-signed">
            <span className="terms-acceptance-mark" aria-hidden>
              ✓
            </span>
            <div>
              <p className="terms-acceptance-title">Прочетен и приет</p>
              <p className="terms-acceptance-detail">На {formattedDate}.</p>
            </div>
            {justAccepted ? (
              <p className="terms-acceptance-toast">Записано локално в твоя браузър.</p>
            ) : null}
          </div>
        ) : (
          <div className="terms-acceptance-state terms-acceptance-state-pending">
            <span className="terms-acceptance-mark" aria-hidden>
              ~
            </span>
            <div>
              <p className="terms-acceptance-title">Още непрочетен подпис</p>
              <p className="terms-acceptance-detail">
                Прелисти кодекса и натисни „Подписвам“ — само за себе си, за прозрачност.
              </p>
            </div>
            <button type="button" className="terms-acceptance-btn" onClick={accept}>
              Подписвам кодекса
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
