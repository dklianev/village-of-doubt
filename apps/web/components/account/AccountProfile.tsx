"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

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
  const router = useRouter();
  const [savedName, setSavedName] = useState(props.initialName);
  const [name, setName] = useState(props.initialName);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"" | "saved" | "error">("");
  const [errorMessage, setErrorMessage] = useState("");

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
    router.refresh();
    window.setTimeout(() => setStatus(""), 2200);
  }

  return (
    <section className="account-section">
      <header className="account-section-head">
        <h2>Профил</h2>
        <p>Името на масата и входовете към профила.</p>
      </header>

      <div className="account-profile-form">
        <div className="account-field">
          <label htmlFor="account-name">Име на масата</label>
          <div className="account-field-inline">
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
              className="account-save-btn"
              onClick={saveName}
              disabled={saving || name.trim() === savedName}
            >
              {saving ? "Запазваме..." : "Запази"}
            </button>
          </div>
          {status === "saved" ? <p className="account-status account-status-ok">Запазено.</p> : null}
          {status === "error" ? (
            <p className="account-status account-status-error" role="alert">
              {errorMessage}
            </p>
          ) : null}
        </div>

        <div className="account-field">
          <p className="account-field-label">Имейл</p>
          <div className="account-field-static">
            <span>{props.email}</span>
            {props.emailVerified ? (
              <span className="account-badge account-badge-ok">Потвърден</span>
            ) : (
              <Link href="/verify-email" className="account-badge account-badge-warn">
                Непотвърден · потвърди →
              </Link>
            )}
          </div>
        </div>

        <div className="account-field">
          <p className="account-field-label">Активни входове</p>
          <ul className="account-provider-list">
            {props.providers.map((provider) => (
              <li key={provider} data-provider={provider}>
                <span className="account-provider-icon" aria-hidden>
                  {PROVIDER_ICONS[provider] ?? "·"}
                </span>
                <span>{PROVIDER_LABELS[provider] ?? provider}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
