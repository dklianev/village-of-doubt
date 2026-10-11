"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Pencil } from "lucide-react";
import { ProfilePortrait } from "@/components/ProfilePortrait";
import styles from "./Account.module.css";

type Identity = { name: string; avatarId: string };
const IdentityContext = createContext<{
  identity: Identity;
  saveIdentity: (identity: Identity) => void;
} | null>(null);

export function AccountIdentityProvider({ initial, children }: { initial: Identity; children: ReactNode }) {
  const [identity, saveIdentity] = useState(initial);
  return <IdentityContext.Provider value={{ identity, saveIdentity }}>{children}</IdentityContext.Provider>;
}

export function useAccountIdentity() {
  return useContext(IdentityContext);
}

export function AccountIdentity({ name, avatarId, memberSince }: Identity & { memberSince: string | null }) {
  const saved = useAccountIdentity()?.identity ?? { name, avatarId };
  return (
    <div className={styles.heroIdentity}>
      <div className={styles.heroAvatar} role="img" aria-label={`Портрет на ${saved.name || "играча"}`}>
        <ProfilePortrait avatarId={saved.avatarId} decorative />
      </div>
      <div className={styles.heroDetails}>
        <p className={styles.heroKicker}>Лично досие</p>
        <h1 className={styles.heroName}>{saved.name || "Без име"}</h1>
        {memberSince ? <p className={styles.heroMeta}>На масата от {memberSince}</p> : null}
        <a href="#account-identity" className={styles.heroEdit} onClick={(event) => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
            || window.location.hash !== "#account-identity") return;
          // Firefox clears history.state on a repeated native hash navigation.
          event.preventDefault();
          document.getElementById("account-identity")?.scrollIntoView({ block: "start", behavior: "instant" });
        }}><Pencil size={14} aria-hidden="true" />Редактирай</a>
      </div>
    </div>
  );
}
