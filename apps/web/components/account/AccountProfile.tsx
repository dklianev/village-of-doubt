"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { normalizeAvatarId, type AvatarId } from "@werewolf/shared";
import { ProfilePortrait } from "@/components/ProfilePortrait";
import { AVATAR_OPTIONS, type AvatarGroup } from "@/lib/avatar-catalog";
import { authClient } from "@/lib/auth-client";
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
  const statusTimerRef = useRef<number | null>(null);
  const avatarButtonRefs = useRef<Partial<Record<AvatarId, HTMLButtonElement | null>>>({});

  useEffect(() => {
    return () => {
      if (statusTimerRef.current !== null) {
        window.clearTimeout(statusTimerRef.current);
      }
    };
  }, []);

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
    const next = name.trim();
    if (next.length < 2) {
      setStatus("error");
      setErrorMessage("Името трябва да е поне 2 символа.");
      return;
    }

    setSaving(true);
    setStatus("");
    const result = await authClient.updateUser({ name: next, avatarId });
    setSaving(false);

    if (result.error) {
      setStatus("error");
      setErrorMessage("Грешка при запис.");
      return;
    }

    setSavedName(next);
    setSavedAvatarId(avatarId);
    setName(next);
    setStatus("saved");
    if (statusTimerRef.current !== null) {
      window.clearTimeout(statusTimerRef.current);
    }
    statusTimerRef.current = window.setTimeout(() => {
      setStatus("");
      statusTimerRef.current = null;
    }, 2200);
    window.dispatchEvent(new Event("auth-session-change"));
  }

  return (
    <section className={`${styles.section} ${styles.profileSection}`}>
      <header className={styles.sectionHead}>
        <p className={styles.sectionKicker}>регистър на самоличността</p>
        <h2>Твоят образ на масата</h2>
        <p>Избери портрет и име. Те оформят личното ти досие.</p>
      </header>

      <div className={styles.profileForm}>
        <div className={styles.identityEditor}>
          <div className={styles.identityPreview} aria-label="Преглед на избрания образ">
            <ProfilePortrait avatarId={avatarId} decorative />
            <span>{name.trim() || "Без име"}</span>
            <span className={styles.registrationStamp} aria-hidden="true">Регистриран</span>
          </div>
          <div className={`${styles.field} ${styles.nameField}`}>
            <label htmlFor="account-name">Име на масата</label>
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
              className={styles.saveButton}
              onClick={saveProfile}
              disabled={saving || (name.trim() === savedName && avatarId === savedAvatarId)}
              aria-busy={saving}
            >
              {saving ? "Запазваме..." : "Запази досието"}
            </button>
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
                onClick={() => setAvatarId(option.id)}
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

        <div className={styles.profileStatusRow}>
          {status === "saved" ? (
            <p className={`${styles.status} ${styles.statusOk}`} role="status" aria-live="polite">
              Подпечатано
            </p>
          ) : null}
          {status === "error" ? (
            <p className={`${styles.status} ${styles.statusError}`} role="alert">
              {errorMessage}
            </p>
          ) : null}
        </div>

        <div className={`${styles.field} ${styles.accessField}`}>
          <p className={styles.fieldLabel}>Имейл</p>
          <div className={styles.fieldStatic}>
            <span>{props.email}</span>
            {props.emailVerified ? (
              <span className={`${styles.badge} ${styles.badgeOk}`}>Потвърден</span>
            ) : (
              <Link href="/verify-email" className={`${styles.badge} ${styles.badgeWarn}`}>
                Непотвърден · потвърди →
              </Link>
            )}
          </div>
        </div>

        <div className={`${styles.field} ${styles.accessField}`}>
          <p className={styles.fieldLabel}>Активни входове</p>
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
      </div>
    </section>
  );
}
