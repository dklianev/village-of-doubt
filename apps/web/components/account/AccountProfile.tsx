"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Display, PaperCard } from "@werewolf/ui/server";
import { authClient } from "@/lib/auth-client";
import styles from "./AccountProfile.module.css";

const PROVIDER_LABELS: Record<string, string> = {
  credential: "Имейл и парола",
  google: "Google",
  discord: "Discord",
};

const PROVIDER_ICONS: Record<string, string> = {
  credential: "@",
  google: "G",
  discord: "D",
};

interface Props {
  initialName: string;
  email: string;
  emailVerified: boolean;
  providers: string[];
}

export function AccountProfile(props: Props) {
  const [savedName, setSavedName] = useState(props.initialName);
  const [name, setName] = useState(props.initialName);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"" | "saved" | "error">("");
  const [errorMessage, setErrorMessage] = useState("");
  const statusTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (statusTimerRef.current !== null) {
        window.clearTimeout(statusTimerRef.current);
      }
    };
  }, []);

  async function saveName() {
    const next = name.trim();
    if (next.length < 2) {
      setStatus("error");
      setErrorMessage("Името трябва да е поне 2 символа.");
      return;
    }

    setSaving(true);
    setStatus("");
    const result = await authClient.updateUser({ name: next });
    setSaving(false);

    if (result.error) {
      setStatus("error");
      setErrorMessage("Грешка при запис.");
      return;
    }

    setSavedName(next);
    setName(next);
    setStatus("saved");
    if (statusTimerRef.current !== null) {
      window.clearTimeout(statusTimerRef.current);
    }
    statusTimerRef.current = window.setTimeout(() => {
      setStatus("");
      statusTimerRef.current = null;
    }, 2200);
  }

  return (
    <section aria-labelledby="account-profile-title">
      <PaperCard eyebrow="ПРОФИЛ" density="md">
        <div className="account-card-content">
          <header className="account-section-head">
            <Display size="h3" as="h2">
              <span id="account-profile-title">Досие</span>
            </Display>
            <p>Името на масата и входовете към досието.</p>
          </header>

          <div className={styles.profileForm}>
            <div className={styles.field}>
              <label htmlFor="account-name">Име на масата</label>
              <div className={styles.fieldInline}>
                <input
                  id="account-name"
                  type="text"
                  value={name}
                  maxLength={32}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                />
                <button
                  type="button"
                  className={styles.saveBtn}
                  onClick={saveName}
                  disabled={saving || name.trim() === savedName}
                  aria-busy={saving}
                >
                  {saving ? "Запазваме..." : "Запази"}
                </button>
              </div>
              {status === "saved" ? (
                <p className="account-status account-status-ok" role="status" aria-live="polite">
                  Запазено.
                </p>
              ) : null}
              {status === "error" ? (
                <p className="account-status account-status-error" role="alert">
                  {errorMessage}
                </p>
              ) : null}
            </div>

            <div className={styles.field}>
              <p className={styles.fieldLabel}>Имейл</p>
              <div className={styles.fieldStatic}>
                <span>{props.email}</span>
                {props.emailVerified ? (
                  <span className={`${styles.badge} ${styles.badgeOk}`}>Потвърден</span>
                ) : (
                  <Link href="/verify-email" className={`${styles.badge} ${styles.badgeWarn}`}>
                    Непотвърден · потвърди →
                  </Link>
                )}
              </div>
            </div>

            <div className={styles.field}>
              <p className={styles.fieldLabel}>Активни входове</p>
              <ul className={styles.providerList}>
                {props.providers.map((provider) => (
                  <li key={provider} data-provider={provider}>
                    <span className={styles.providerIcon} aria-hidden>
                      {PROVIDER_ICONS[provider] ?? "·"}
                    </span>
                    <span>{PROVIDER_LABELS[provider] ?? provider}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </PaperCard>
    </section>
  );
}
