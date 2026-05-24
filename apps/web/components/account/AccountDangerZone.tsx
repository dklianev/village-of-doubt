"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, Display, PaperCard, Pill } from "@werewolf/ui";
import { authClient } from "@/lib/auth-client";
import styles from "./AccountDangerZone.module.css";

export function AccountDangerZone({ email }: { email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [status, setStatus] = useState<"idle" | "deleting" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const canDelete = confirmText.trim().toLocaleUpperCase("bg-BG") === "ИЗТРИЙ";

  function closeDialog() {
    if (status === "deleting") {
      return;
    }
    setOpen(false);
    setConfirmText("");
    setErrorMessage("");
    setStatus("idle");
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setOpen(true);
      return;
    }
    closeDialog();
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
    <section aria-labelledby="account-danger-title">
      <PaperCard eyebrow="ОПАСНА ЗОНА" density="md">
        <div className={`account-card-content ${styles.dangerCardContent}`}>
          <header className="account-section-head">
            <Display size="h3" as="h2">
              <span id="account-danger-title">Опасна зона</span>
            </Display>
            <p>Окончателно изтриване на твоето досие.</p>
          </header>

          <div className={styles.dangerBody}>
            <p>
              Изтриването премахва досието и легендите. Имената от твоите игри остават в архива,
              но се заменят с „Изтрит играч“, за да не се чупи историята на другите играчи.
            </p>

            <Pill intent="danger" onClick={() => setOpen(true)} style={{ justifySelf: "start" }}>
              Изтрий моето досие
            </Pill>

            <Dialog
              open={open}
              onOpenChange={handleOpenChange}
              title="Сигурен/сигурна ли си?"
              description="За потвърждение напиши ИЗТРИЙ. Това действие премахва досието и легендите завинаги."
              footer={
                <>
                  <Pill intent="secondary" onClick={closeDialog} disabled={status === "deleting"}>
                    Отказ
                  </Pill>
                  <Pill
                    intent="danger"
                    disabled={!canDelete || status === "deleting"}
                    aria-busy={status === "deleting"}
                    onClick={deleteAccount}
                  >
                    {status === "deleting" ? "Изтриваме..." : "Изтрий завинаги"}
                  </Pill>
                </>
              }
            >
              <div style={{ display: "grid", gap: "14px" }}>
                <p className={styles.confirmEmail}>
                  Досие: <strong>{email || "няма имейл"}</strong>
                </p>
                <label className={styles.confirmField}>
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
              </div>
            </Dialog>
          </div>
        </div>
      </PaperCard>
    </section>
  );
}
