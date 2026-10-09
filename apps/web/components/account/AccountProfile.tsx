"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { RotateCcw, Save } from "lucide-react";
import { normalizeAvatarId, type AvatarId } from "@werewolf/shared";
import { ProfilePortrait } from "@/components/ProfilePortrait";
import { AVATAR_OPTIONS, type AvatarGroup } from "@/lib/avatar-catalog";
import { authClient } from "@/lib/auth-client";
import { useAccountIdentity } from "./AccountIdentity";
import styles from "./Account.module.css";

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
  initialAvatarId: string;
  email: string;
  emailVerified: boolean;
  providers: string[];
}

export function AccountProfile(props: Props) {
  const [savedName, setSavedName] = useState(props.initialName);
  const [name, setName] = useState(props.initialName);
  const [savedAvatarId, setSavedAvatarId] = useState<AvatarId>(normalizeAvatarId(props.initialAvatarId));
  const [avatarId, setAvatarId] = useState<AvatarId>(normalizeAvatarId(props.initialAvatarId));
  const [avatarFilter, setAvatarFilter] = useState<"all" | AvatarGroup>("all");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"" | "saved" | "error">("");
  const [errorMessage, setErrorMessage] = useState("");
  const pendingRef = useRef(false);
  const identity = useAccountIdentity();
  const avatarButtonRefs = useRef<Partial<Record<AvatarId, HTMLButtonElement | null>>>({});

  const dirty = name.trim() !== savedName || avatarId !== savedAvatarId;

  const filteredAvatars = useMemo(
    () => avatarFilter === "all" ? AVATAR_OPTIONS : AVATAR_OPTIONS.filter((option) => option.group === avatarFilter),
    [avatarFilter],
  );
  const selectedVisibleIndex = filteredAvatars.findIndex((option) => option.id === avatarId);
  const rovingIndex = selectedVisibleIndex >= 0 ? selectedVisibleIndex : 0;

  function handleAvatarKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (filteredAvatars.length === 0) {
      return;
    }

    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (index + 1) % filteredAvatars.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (index - 1 + filteredAvatars.length) % filteredAvatars.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = filteredAvatars.length - 1;
    } else if (event.key === " ") {
      event.preventDefault();
      setAvatarId(filteredAvatars[index]!.id);
      return;
    }

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    const nextAvatar = filteredAvatars[nextIndex]!;
    setAvatarId(nextAvatar.id);
    avatarButtonRefs.current[nextAvatar.id]?.focus();
  }

  async function saveProfile() {
    if (pendingRef.current || !dirty) return;
    const submittedName = name;
    const submittedAvatarId = avatarId;
    const next = name.trim();
    if (next.length < 2 || next.length > 32) {
      setStatus("error");
      setErrorMessage("Името трябва да е между 2 и 32 символа.");
      return;
    }

    pendingRef.current = true;
    setSaving(true);
    setStatus("");
    try {
      const result = await authClient.updateUser({ name: next, avatarId: submittedAvatarId });
      if (result.error) {
        setStatus("error");
        setErrorMessage("Промените не са запазени. Опитай отново след малко.");
        return;
      }

      setSavedName(next);
      setSavedAvatarId(submittedAvatarId);
      setName((current) => current === submittedName ? next : current);
      identity?.saveIdentity({ name: next, avatarId: submittedAvatarId });
      setStatus("saved");
      window.dispatchEvent(new Event("auth-session-change"));
    } catch {
      setStatus("error");
      setErrorMessage("Не успяхме да запазим промените. Провери връзката си и опитай отново.");
    } finally {
      pendingRef.current = false;
      // Activity can hide this page while the request completes; settle its state too.
      setSaving(false);
    }
  }

  return (
    <section className={`${styles.section} ${styles.profileSection}`}>
      <header className={styles.sectionHead}>
        <h2>Твоят образ на масата</h2>
        <p>Така те виждат другите играчи.</p>
      </header>

      <form className={styles.profileForm} onSubmit={(event) => { event.preventDefault(); void saveProfile(); }}>
        <div className={styles.identityEditor}>
          <div className={styles.identityPreview} aria-label="Преглед на избрания образ">
            <ProfilePortrait avatarId={avatarId} decorative />
            <span>{name.trim() || "Без име"}</span>
          </div>
          <div className={`${styles.field} ${styles.nameField}`}>
            <label htmlFor="account-name">Име на масата</label>
            <input
              id="account-name"
              type="text"
              value={name}
              maxLength={32}
              onChange={(event) => { setName(event.target.value); setStatus(""); }}
              autoComplete="name"
              aria-describedby="account-profile-feedback"
            />
          </div>
        </div>

        <fieldset className={styles.avatarFieldset}>
          <legend id="account-avatar-legend">Избери образ</legend>
          <div className={styles.avatarFilter} aria-label="Филтър за образи" role="group">
            <button type="button" aria-pressed={avatarFilter === "all"} data-active={avatarFilter === "all"} onClick={() => setAvatarFilter("all")}>Всички</button>
            <button type="button" aria-pressed={avatarFilter === "women"} data-active={avatarFilter === "women"} onClick={() => setAvatarFilter("women")}>Женски образи</button>
            <button type="button" aria-pressed={avatarFilter === "men"} data-active={avatarFilter === "men"} onClick={() => setAvatarFilter("men")}>Мъжки образи</button>
          </div>
          <div className={styles.avatarGrid} role="radiogroup" aria-labelledby="account-avatar-legend">
            {filteredAvatars.map((option, index) => (
              <button
                key={option.id}
                ref={(node) => {
                  avatarButtonRefs.current[option.id] = node;
                }}
                type="button"
                role="radio"
                className={styles.avatarOption}
                data-avatar-id={option.id}
                data-selected={avatarId === option.id}
                aria-checked={avatarId === option.id}
                aria-label={option.labelBg}
                tabIndex={index === rovingIndex ? 0 : -1}
                onClick={() => { setAvatarId(option.id); setStatus(""); }}
                onKeyDown={(event) => handleAvatarKeyDown(event, index)}
              >
                <span className={styles.avatarOptionImage}>
                  <ProfilePortrait avatarId={option.id} decorative />
                </span>
                <span className={styles.avatarOptionLabel}>{option.labelBg}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <div className={styles.profileActions}>
          <button
            type="submit"
            className={`btn btn-primary ${styles.saveButton}`}
            disabled={saving || !dirty}
            aria-busy={saving}
          >
            <Save size={16} aria-hidden="true" />
            {saving ? "Запазваме..." : "Запази досието"}
          </button>
          {dirty ? (
            <button type="button" className={styles.revertButton} disabled={saving}
              onClick={() => { setName(savedName); setAvatarId(savedAvatarId); setStatus(""); }}>
              <RotateCcw size={16} aria-hidden="true" />Отмени промените
            </button>
          ) : null}
        </div>
        <div id="account-profile-feedback" className={styles.profileStatusRow}>
          {status === "error" ? <p className={`${styles.status} ${styles.statusError}`} role="alert">{errorMessage}</p>
            : <p className={`${styles.status} ${status === "saved" ? styles.statusOk : ""}`} role="status">
              {saving ? "Запазване на изпратените промени..." : status === "saved"
                ? dirty ? "Запазено. Имаш и нови незапазени промени." : "Запазено"
                : dirty ? "Имаш незапазени промени." : ""}
            </p>}
        </div>

        <div className={`${styles.field} ${styles.accessField}`}>
          <p className={styles.fieldLabel}>Имейл</p>
          <div className={styles.fieldStatic}>
            <span>{props.email}</span>
            {props.emailVerified ? (
              <span className={`${styles.badge} ${styles.badgeOk}`}>Потвърден</span>
            ) : (
              <Link href="/verify-email?redirect=%2Faccount" className={`${styles.badge} ${styles.badgeWarn}`}>
                Непотвърден · потвърди →
              </Link>
            )}
          </div>
        </div>

        <div className={`${styles.field} ${styles.accessField}`}>
          <p className={styles.fieldLabel}>Начини за вход</p>
          {props.providers.length === 0 ? <p className={styles.emptyNote}>Начините за вход не са достъпни в момента.</p> : null}
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
      </form>
    </section>
  );
}
