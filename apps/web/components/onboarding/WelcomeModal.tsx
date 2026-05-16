"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

const STORAGE_KEY = "welcome-modal-shown";

export function WelcomeModal() {
  const { data: session } = authClient.useSession();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) return;
    if (window.localStorage.getItem(STORAGE_KEY)) return;
    if (window.localStorage.getItem("tutorial-completed")) {
      window.localStorage.setItem(STORAGE_KEY, "1");
      return;
    }
    setVisible(true);
  }, [session?.user?.id]);

  function dismiss() {
    window.localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  const displayName = session?.user?.name ?? "приятел";

  return (
    <div className="welcome-modal-backdrop" role="presentation" onClick={dismiss}>
      <aside className="welcome-modal" role="dialog" aria-label="Добре дошъл" onClick={(event) => event.stopPropagation()}>
        <p className="welcome-kicker">добре дошъл</p>
        <h2>Здравей, {displayName}.</h2>
        <p className="welcome-body">
          Първа игра за теб? Имаме шест сцени, които те водят през една вечер на масата - нощ, ден и подозрение.
        </p>
        <p className="welcome-body">
          Иначе избери семейство игри и създай първа стая. Приятели се канят с код.
        </p>
        <div className="welcome-actions">
          <Link href="/tutorial?welcome=1" className="btn btn-primary" onClick={dismiss}>
            Виж шестте сцени
          </Link>
          <button type="button" className="btn btn-secondary" onClick={dismiss}>
            Знам какво правя - пропусни
          </button>
        </div>
      </aside>
    </div>
  );
}
