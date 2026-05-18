"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function AccountDangerZone() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "deleting" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function deleteAccount() {
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
      router.push("/");
      router.refresh();
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

        {open ? (
          <div className="account-danger-confirm">
            <p>
              <strong>Сигурен/сигурна ли си?</strong> Това действие не може да се върне.
            </p>
            {errorMessage ? (
              <p className="account-status account-status-error" role="alert">
                {errorMessage}
              </p>
            ) : null}
            <div className="account-danger-actions">
              <button
                type="button"
                className="account-danger-btn"
                onClick={deleteAccount}
                disabled={status === "deleting"}
              >
                {status === "deleting" ? "Изтриваме..." : "Да, изтрий профила"}
              </button>
              <button type="button" className="account-cancel-btn" onClick={() => setOpen(false)}>
                Отказ
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="account-danger-btn" onClick={() => setOpen(true)}>
            Изтрий моя профил
          </button>
        )}
      </div>
    </section>
  );
}
