"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

interface Props {
  userId: string;
  email: string;
  name: string;
  image: string | null;
  emailVerified: boolean;
  providers: string[];
}

const PROVIDER_LABELS: Record<string, string> = {
  credential: "Имейл и парола",
  google: "Google",
  discord: "Discord",
};

export function AccountClient(props: Props) {
  const router = useRouter();
  const [name, setName] = useState(props.name);
  const [savingName, setSavingName] = useState(false);
  const [nameStatus, setNameStatus] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<"idle" | "deleting" | "error">("idle");
  const [deleteError, setDeleteError] = useState("");
  const initial = (props.name[0] ?? "?").toUpperCase();

  async function saveName() {
    const nextName = name.trim();
    if (nextName.length < 2) {
      setNameStatus("Името трябва да е поне 2 символа.");
      return;
    }

    setSavingName(true);
    setNameStatus("");
    const result = await authClient.updateUser({ name: nextName });
    setSavingName(false);

    if (result.error) {
      setNameStatus("Грешка при запис.");
      return;
    }

    setName(nextName);
    setNameStatus("Запазено.");
    router.refresh();
    setTimeout(() => setNameStatus(""), 2200);
  }

  async function deleteAccount() {
    setDeleteStatus("deleting");
    setDeleteError("");

    try {
      const response = await fetch("/api/account/delete", { method: "POST" });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setDeleteError(body.error ?? "Грешка при изтриване.");
        setDeleteStatus("error");
        return;
      }

      await authClient.signOut();
      router.push("/");
      router.refresh();
    } catch {
      setDeleteError("Грешка при изтриване.");
      setDeleteStatus("error");
    }
  }

  function exportData() {
    window.location.href = "/api/account/export";
  }

  return (
    <section className="dossier-stage">
      <figure className="dossier-art" aria-hidden />

      <article className="dossier-card">
        <header className="dossier-head">
          <p className="dossier-kicker">досие</p>
          <h1>Твоето място на масата.</h1>
          <p className="dossier-subtitle">
            Профилът пази историята, постиженията и поканите. Тук ги управляваш.
          </p>
        </header>

        <section className="dossier-section">
          <h2>Профил</h2>
          <div className="dossier-row">
            <div className="dossier-avatar">
              {props.image ? <img src={props.image} alt="" /> : <span>{initial}</span>}
            </div>
            <div className="dossier-meta">
              <label>
                <span>Име на масата</span>
                <input value={name} maxLength={32} onChange={(event) => setName(event.target.value)} />
              </label>
              <button
                type="button"
                className="btn btn-secondary dossier-save-btn"
                onClick={saveName}
                disabled={savingName || name.trim() === props.name}
              >
                {savingName ? "Запазване..." : "Запази"}
              </button>
              {nameStatus ? <p className="dossier-status">{nameStatus}</p> : null}
            </div>
          </div>

          <p className="dossier-email">
            <strong>Имейл:</strong> {props.email}
            {props.emailVerified ? (
              <span className="dossier-badge dossier-badge-ok">Потвърден</span>
            ) : (
              <span className="dossier-badge dossier-badge-warn">Непотвърден</span>
            )}
          </p>
        </section>

        <section className="dossier-section">
          <h2>Входове</h2>
          <ul className="dossier-provider-list">
            {props.providers.map((provider) => (
              <li key={provider}>{PROVIDER_LABELS[provider] ?? provider}</li>
            ))}
          </ul>
        </section>

        <section className="dossier-section">
          <h2>Твоите данни</h2>
          <p>Имаш право да изтеглиш всичко, което сме записали за теб.</p>
          <button type="button" className="btn btn-secondary" onClick={exportData}>
            Изтегли моите данни
          </button>
        </section>

        <section className="dossier-section dossier-danger">
          <h2>Изтрий профила</h2>
          <p>
            Изтриването е окончателно. Имената от твоите игри ще бъдат заменени с "Изтрит играч", а
            постиженията ще изчезнат.
          </p>

          {showDeleteConfirm ? (
            <div className="dossier-confirm">
              <p>
                <strong>Сигурен/сигурна ли си?</strong> Това действие не може да бъде върнато.
              </p>
              {deleteError ? (
                <p className="dossier-error" role="alert">
                  {deleteError}
                </p>
              ) : null}
              <div className="dossier-confirm-actions">
                <button type="button" className="btn btn-danger" onClick={deleteAccount} disabled={deleteStatus === "deleting"}>
                  {deleteStatus === "deleting" ? "Изтриваме..." : "Да, изтрий"}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)}>
                  Отмени
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn btn-danger" onClick={() => setShowDeleteConfirm(true)}>
              Изтрий моя профил
            </button>
          )}
        </section>

        <footer className="dossier-foot">
          <Link href="/" className="dossier-foot-link">
            Към началото
          </Link>
        </footer>
      </article>
    </section>
  );
}
