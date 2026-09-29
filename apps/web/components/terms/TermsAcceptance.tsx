"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { safeLocalStorage } from "@/lib/safe-storage";

const STORAGE_KEY = "terms-read-version";
const CURRENT_VERSION = "2026-05-19";

export function TermsAcceptance() {
  const [readAt, setReadAt] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [persisted, setPersisted] = useState(true);

  useEffect(() => {
    setReadAt(readMarkerDate(safeLocalStorage.getJson<unknown>(STORAGE_KEY)));
    setReady(true);
  }, []);

  function markRead() {
    const now = new Date().toISOString();
    setPersisted(safeLocalStorage.setJson(STORAGE_KEY, { version: CURRENT_VERSION, readAt: now }));
    setReadAt(now);
  }

  const formattedDate = readAt
    ? new Intl.DateTimeFormat("bg-BG", { dateStyle: "long" }).format(new Date(readAt))
    : null;

  return (
    <section className="terms-section terms-section-acceptance">
      <header className="terms-section-head">
        <p className="terms-section-kicker">локална отметка</p>
        <h2>Отбележи като прочетено</h2>
        <p className="terms-section-lede">
          Отметката е само за този браузър. Не е свързана с досие и не записва съгласие с условията.
        </p>
      </header>

      <div className="terms-acceptance-body" role="status" aria-live="polite">
        {readAt ? (
          <div className="terms-acceptance-state terms-acceptance-state-signed">
            <span className="terms-acceptance-mark" aria-hidden>
              <Check size={22} />
            </span>
            <div>
              <p className="terms-acceptance-title">Отбелязано като прочетено</p>
              <p className="terms-acceptance-detail">На <time dateTime={readAt}>{formattedDate}</time>.</p>
              <p className="terms-acceptance-detail">
                {persisted
                  ? "Запазено само в този браузър."
                  : "Браузърът не позволи запазване. Отметката е само за тази отворена страница."}
              </p>
            </div>
          </div>
        ) : (
          <div className="terms-acceptance-state terms-acceptance-state-pending">
            <span className="terms-acceptance-mark" aria-hidden>
              ~
            </span>
            <div>
              <p className="terms-acceptance-title">{ready ? "Няма отметка в този браузър" : "Проверяваме отметката..."}</p>
            </div>
            <button {...{ autoComplete: "off" }} type="button" className="terms-acceptance-btn" onClick={markRead} disabled={!ready}>
              <Check size={16} aria-hidden="true" />
              Отбележи като прочетено
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function readMarkerDate(value: unknown): string | null {
  if (
    !value || typeof value !== "object" || Array.isArray(value) ||
    !("version" in value) || value.version !== CURRENT_VERSION ||
    !("readAt" in value) || typeof value.readAt !== "string"
  ) {
    return null;
  }

  const timestamp = Date.parse(value.readAt);
  if (
    !Number.isFinite(timestamp) || timestamp < Date.parse(CURRENT_VERSION) ||
    timestamp > Date.now() || new Date(timestamp).toISOString() !== value.readAt
  ) {
    return null;
  }
  return value.readAt;
}
