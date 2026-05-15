"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function AccountClient({ name, email, image }: { name: string; email: string; image: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState("");
  const initial = name.charAt(0).toUpperCase();

  async function deleteAccount() {
    setStatus("");
    const response = await fetch("/api/account/delete", { method: "POST" });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setStatus(body.error ?? "Не успяхме да изтрием профила.");
      return;
    }

    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="account-panel mt-6">
      <div className="account-profile-row">
        <span className="account-avatar" aria-hidden>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" />
          ) : (
            <span>{initial}</span>
          )}
        </span>
        <div>
          <h2>{name}</h2>
          {email ? <p>{email}</p> : <p>Профил без публичен имейл.</p>}
        </div>
      </div>

      <section className="account-danger">
        <h2>Изтриване на профил</h2>
        <p>Това премахва профила и активните сесии. Историята на вече завършените игри може да остане като публичен запис.</p>
        {confirming ? (
          <div className="account-danger-actions">
            <button type="button" className="btn btn-primary" onClick={deleteAccount}>
              Потвърди изтриването
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)}>
              Откажи
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={() => setConfirming(true)}>
            Изтрий профила
          </button>
        )}
        {status ? <p className="account-status" role="alert">{status}</p> : null}
      </section>
    </div>
  );
}
