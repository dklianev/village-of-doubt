"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { endAuthSession } from "@/lib/auth-session-end";
import styles from "./Account.module.css";

export function AccountDangerZone({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [status, setStatus] = useState<"idle" | "deleting" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dialogActiveRef = useRef(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogTitleId = useId();
  const canDelete = confirmText.trim().toLocaleUpperCase("bg-BG") === "ИЗТРИЙ";

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    dialogActiveRef.current = true;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }

    // Activity preserves the DOM, but native modality must be released while hidden.
    return () => {
      dialogActiveRef.current = false;
      if (dialog.open) dialog.close();
    };
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
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ intent: "delete-account" }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setErrorMessage(data.error ?? "Грешка при изтриване.");
        setStatus("error");
        return;
      }
    } catch {
      setErrorMessage("Грешка при изтриване.");
      setStatus("error");
      return;
    }

    try {
      // Best-effort cookie cleanup; deletion has already revoked server sessions.
      await authClient.signOut({ fetchOptions: { signal: AbortSignal.timeout(1_500), retry: 0 } });
    } catch {
      // A failed or timed-out cleanup must still end the authenticated document.
    }
    endAuthSession();
  }

  return (
    <section className={`${styles.archivePanel} ${styles.dangerSection}`}>
      <header className={styles.sectionHead}>
        <p className={styles.sectionKicker}>Изтриване на профила</p>
        <h2>Опасна зона</h2>
        <p>Окончателно изтриване на твоето досие.</p>
      </header>

      <div className={styles.dangerBody}>
        <p>
          Изтриването премахва досието и легендите. Историята на общите игри остава в архива,
          като името ти се заменя с „Изтрит играч“.
        </p>

        <button ref={triggerRef} type="button" className={styles.dangerButton} onClick={() => setOpen(true)}>
          <Trash2 size={16} aria-hidden="true" />
          Изтрий моето досие
        </button>

        <dialog
          ref={dialogRef}
          className={styles.dialog}
          aria-labelledby={dialogTitleId}
          onCancel={(event) => {
            if (status === "deleting") {
              event.preventDefault();
              return;
            }
            closeDialog();
          }}
          onClose={() => {
            // Cleanup queues a close event that can arrive after the dialog reopens.
            if (!dialogActiveRef.current || dialogRef.current?.open) return;
            setOpen(false);
            triggerRef.current?.focus({ preventScroll: true });
          }}
        >
          <p className={styles.dialogKicker}>необратимо действие</p>
          <h3 id={dialogTitleId}>Сигурен/сигурна ли си?</h3>
          <p>
            За потвърждение напиши <strong>ИЗТРИЙ</strong>. Това действие премахва досието и
            легендите завинаги.
          </p>
          <p className={styles.dialogEmail}>
            Досие: <strong>{email || "няма имейл"}</strong>
          </p>
          <label className={styles.dialogField}>
            <span>Потвърждение</span>
            <input
              type="text"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder="ИЗТРИЙ"
              aria-label="Напиши ИЗТРИЙ за потвърждение"
              autoComplete="off"
              autoCapitalize="characters"
              autoFocus
              disabled={status === "deleting"}
            />
          </label>
          {errorMessage ? (
            <p className={`${styles.status} ${styles.statusError}`} role="alert">
              {errorMessage}
            </p>
          ) : null}
          <div className={styles.dialogActions}>
            <button type="button" className={styles.cancelButton} onClick={closeDialog} disabled={status === "deleting"}>
              Отказ
            </button>
            <button
              type="button"
              className={styles.dangerButton}
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
