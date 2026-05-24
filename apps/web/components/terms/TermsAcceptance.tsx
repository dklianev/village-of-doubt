"use client";

import { Display, PaperCard } from "@werewolf/ui";
import { useEffect, useState } from "react";
import styles from "./TermsAcceptance.module.css";

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
    <section className={`terms-section ${styles.acceptanceSection}`}>
      <PaperCard eyebrow="ПОДПИС НА МАСАТА" density="lg">
        <header className="terms-section-head">
          <Display as="h2" size="h3">
            {userName ? `${userName}, прочете ли кодекса?` : "Прочете ли кодекса?"}
          </Display>
          <p className="terms-section-lede">
            Като играеш, ти приемаш правилата по подразбиране. Този подпис е символичен — показва,
            че съзнателно си се запознал с обещанията на масата.
          </p>
        </header>

        <div className={styles.acceptanceBody}>
          {acceptedAt ? (
            <div className={`${styles.acceptanceState} ${styles.acceptanceStateSigned}`}>
              <span className={styles.acceptanceMark} aria-hidden>
                ✓
              </span>
              <div>
                <p className={styles.acceptanceTitle}>Прочетен и приет</p>
                <p className={styles.acceptanceDetail}>На {formattedDate}.</p>
              </div>
              {justAccepted ? (
                <p className={styles.acceptanceToast}>Записано локално в твоя браузър.</p>
              ) : null}
            </div>
          ) : (
            <div className={`${styles.acceptanceState} ${styles.acceptanceStatePending}`}>
              <span className={styles.acceptanceMark} aria-hidden>
                ~
              </span>
              <div>
                <p className={styles.acceptanceTitle}>Още непрочетен подпис</p>
                <p className={styles.acceptanceDetail}>
                  Прелисти кодекса и натисни „Подписвам“ — само за себе си, за прозрачност.
                </p>
              </div>
              <button type="button" className={styles.acceptanceBtn} onClick={accept}>
                Подписвам кодекса
              </button>
            </div>
          )}
        </div>
      </PaperCard>
    </section>
  );
}
