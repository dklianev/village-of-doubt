"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function AccountDangerZone({ email }: { email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [status, setStatus] = useState<"idle" | "deleting" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const canDelete = confirmText.trim().toLocaleUpperCase("bg-BG") === "ИЗТРИЙ";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function closeDialog() {
    if (status === "deleting") {
      return;
    }
    setOpen(false);
    setConfirmText("");
    setErrorMessage("");
    setStatus("idle");
  }

  async function deleteAccount() {
    if (!canDelete || status === "deleting") {
      return;
    }

    setStatus("deleting");
    setErrorMessage("");

    try {
      const response = await fetch("/api/account/delete", { method: "POST" });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setErrorMessage(data.error ?? "Грешка при изтриване.");
        setStatus("error");
        return;
      }

      await authClient.signOut();
      window.dispatchEvent(new Event("auth-session-change"));
      router.replace("/");
    } catch {
      setErrorMessage("Грешка при изтриване.");
      setStatus("error");
    }
  }

  return (
    <section className="account-section account-danger">
      <header className="account-section-head">
        <h2>Опасна зона</h2>
        <p>Окончателно изтриване на твоя профил.</p>
      </header>

      <div className="account-danger-body">
        <p>
          Изтриването премахва профила и постиженията. Имената от твоите игри остават в архива, но
          се заменят с „Изтрит играч“, за да не се чупи историята на другите играчи.
        </p>

        <button type="button" className="account-danger-btn" onClick={() => setOpen(true)}>
          Изтрий моя профил
        </button>

        <dialog
          ref={dialogRef}
          className="danger-confirm-dialog"
          onCancel={(event) => {
            if (status === "deleting") {
              event.preventDefault();
              return;
            }
            closeDialog();
          }}
          onClose={() => setOpen(false)}
        >
          <p className="section-kicker">необратимо действие</p>
          <h3>Сигурен/сигурна ли си?</h3>
          <p>
            За потвърждение напиши <strong>ИЗТРИЙ</strong>. Това действие премахва профила и
            постиженията завинаги.
          </p>
          <p className="danger-confirm-email">
            Профил: <strong>{email || "няма имейл"}</strong>
          </p>
          <label className="danger-confirm-field">
            <span>Потвърждение</span>
            <input
              type="text"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder="ИЗТРИЙ"
              aria-label="Напиши ИЗТРИЙ за потвърждение"
              autoComplete="off"
              autoCapitalize="characters"
            />
          </label>
          {errorMessage ? (
            <p className="account-status account-status-error" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <div className="danger-confirm-actions">
            <button type="button" className="account-cancel-btn" onClick={closeDialog}>
              Отказ
            </button>
            <button
              type="button"
              className="account-danger-btn"
              disabled={!canDelete || status === "deleting"}
              aria-busy={status === "deleting"}
              onClick={deleteAccount}
            >
              {status === "deleting" ? "Изтриваме..." : "Изтрий завинаги"}
            </button>
          </div>
        </dialog>
      </div>
    </section>
  );
}
