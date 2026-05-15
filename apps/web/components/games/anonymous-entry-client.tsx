"use client";

import { type ClipboardEvent, type FormEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  type CommunicationMode,
  type GameFamily,
  type GameMode,
  type NarratorMode,
  type TempoProfile,
} from "@werewolf/shared";
import {
  ANONYMOUS_DISPLAY_NAME_KEY,
  saveAnonymousIdentity,
  validateDisplayNameBg,
} from "@/lib/anonymous-player";

export function AnonymousEntryClient({
  family,
  mode,
  initialCode = "",
}: {
  family: GameFamily;
  mode: GameMode;
  initialCode?: string;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [roomCode, setRoomCode] = useState(cleanRoomCode(initialCode));
  const [spectator, setSpectator] = useState(false);
  const [error, setError] = useState("");
  const [codeShaking, setCodeShaking] = useState(false);
  const [joining, setJoining] = useState(false);
  const slotRefs = useRef<Array<HTMLInputElement | null>>([]);
  const isMafia = family === "mafia";
  const copy = isMafia ? JOIN_COPY.mafia : JOIN_COPY.werewolves;
  const gameRoot = isMafia ? "/mafia" : "/werewolf";
  const playerCount = mode === "mafia_sport" ? 10 : isMafia ? 10 : 8;
  const tempo: TempoProfile = mode === "mafia_sport" ? "sport_mafia" : "normal_online";
  const communication: CommunicationMode = "built_in_chat";
  const narrator: NarratorMode = "automatic";
  const slotCount = Math.max(6, Math.min(12, roomCode.length));
  const canJoin = roomCode.length >= 6 && !joining;
  const codeHint = `${roomCode || "ABC123"} • ${Math.max(6, roomCode.length)} знака • A-Z 0-9`;

  useEffect(() => {
    setDisplayName(window.localStorage.getItem(ANONYMOUS_DISPLAY_NAME_KEY) ?? "");
  }, []);

  const playPath = useMemo(() => {
    const params = new URLSearchParams({
      mode,
      players: String(playerCount),
      communication,
      narrator,
      tempo,
    });
    if (spectator) {
      params.set("spectator", "1");
    }
    return `/play/${roomCode}?${params.toString()}`;
  }, [communication, mode, narrator, playerCount, roomCode, spectator, tempo]);

  function focusSlot(index: number) {
    window.requestAnimationFrame(() => slotRefs.current[index]?.focus());
  }

  function triggerCodeShake() {
    setCodeShaking(false);
    window.requestAnimationFrame(() => setCodeShaking(true));
  }

  function handleSlotChange(index: number, value: string) {
    const nextValue = cleanRoomCode(value);
    if (nextValue.length > 1) {
      setRoomCode(nextValue);
      focusSlot(Math.min(nextValue.length, 12) - 1);
      setError("");
      return;
    }

    setRoomCode((current) => {
      const chars = current.split("");
      if (nextValue) {
        chars[index] = nextValue;
      } else {
        chars.splice(index, 1);
      }
      return cleanRoomCode(chars.join(""));
    });

    if (nextValue && index < 11) {
      focusSlot(index + 1);
    }
    setError("");
  }

  function handleSlotKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !roomCode[index] && index > 0) {
      event.preventDefault();
      focusSlot(index - 1);
    }
    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focusSlot(index - 1);
    }
    if (event.key === "ArrowRight" && index < slotCount - 1) {
      event.preventDefault();
      focusSlot(index + 1);
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pastedCode = cleanRoomCode(event.clipboardData.getData("text"));
    if (!pastedCode) {
      return;
    }
    event.preventDefault();
    setRoomCode(pastedCode);
    setError("");
    focusSlot(Math.min(pastedCode.length, 12) - 1);
  }

  function createRoom() {
    router.push(`${gameRoot}/create`);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nameError = validateDisplayNameBg(displayName);
    if (nameError) {
      setError(nameError);
      return;
    }
    if (!isValidRoomCode(roomCode)) {
      setError("Невалиден код на стая.");
      triggerCodeShake();
      return;
    }

    saveAnonymousIdentity(displayName);
    setError("");
    setJoining(true);
    router.push(playPath);
  }

  return (
    <section className="join-stage" data-theme={family} data-family={family}>
      <aside className="join-side-art" aria-label={copy.artLabel}>
        <div className="join-side-art__caption">
          <p className="join-side-art__kicker">{copy.artKicker}</p>
          <p>{copy.caption}</p>
        </div>
      </aside>

      <form className="join-form-card" onSubmit={submit}>
        <header className="join-header">
          <p className="join-kicker">{copy.kicker}</p>
          <h1 className="join-title">{copy.title}</h1>
          <p className="join-subtitle">{copy.subtitle}</p>
        </header>

        <div className="join-code-panel">
          {error ? (
            <div className="join-error" role="alert">
              <span aria-hidden="true">!</span> {error}
            </div>
          ) : null}
          <p className="join-code-label">Код на стаята</p>
          <div
            className={codeShaking ? "join-codeslots is-shaking" : "join-codeslots"}
            role="group"
            aria-label="Код на стаята"
            onAnimationEnd={() => setCodeShaking(false)}
          >
            {Array.from({ length: slotCount }).map((_, index) => (
              <input
                key={index}
                ref={(element) => {
                  slotRefs.current[index] = element;
                }}
                className="join-codeslot"
                maxLength={1}
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                value={roomCode[index] ?? ""}
                onChange={(event) => handleSlotChange(index, event.target.value)}
                onKeyDown={(event) => handleSlotKeyDown(index, event)}
                onPaste={handlePaste}
                aria-label={`Символ ${index + 1}`}
                data-filled={Boolean(roomCode[index])}
              />
            ))}
          </div>
          <p className="join-code-hint">{codeHint}</p>
        </div>

        <div className="join-fields">
          <label className="join-field">
            <span>{copy.nameLabel}</span>
            <input
              className="join-name-input"
              value={displayName}
              maxLength={24}
              onChange={(event) => {
                setDisplayName(event.target.value);
                setError("");
              }}
              placeholder="Например: Мила"
            />
          </label>

          <button
            type="button"
            className="join-spectator-toggle"
            data-active={spectator}
            onClick={() => setSpectator((value) => !value)}
            aria-pressed={spectator}
          >
            <span className="join-spectator-track" aria-hidden="true">
              <span className="join-spectator-dot" />
            </span>
            <span>{spectator ? "Сядам встрани, без роля" : "Влизам да играя"}</span>
          </button>
        </div>

        <div className="join-actions">
          <button className="join-primary" type="submit" disabled={!canJoin}>
            {joining ? "Хлопаме..." : "Хлопам на вратата"}
          </button>
          <button className="join-secondary" type="button" onClick={createRoom}>
            Създай нова стая
          </button>
        </div>
      </form>
    </section>
  );
}

const JOIN_COPY = {
  mafia: {
    artLabel: "Вход към частен бар",
    artKicker: "частен бар",
    caption: "Името на вратата. Кодът на бара. Останалото — между нас.",
    kicker: "частен бар",
    title: "Покажи кода",
    subtitle: "Името стои на масата. Кодът отваря вратата. Останалото — между нас.",
    nameLabel: "На кое име на масата?",
  },
  werewolves: {
    artLabel: "Вход към тихо село",
    artKicker: "тихо село",
    caption: "Селото е тихо. Покажи знакът си, преди да отвори вратата.",
    kicker: "тихо село",
    title: "Покажи знакът",
    subtitle: "Името върви по селските пътеки. Кодът пуска отвъд оградата.",
    nameLabel: "С кое име в селото?",
  },
} satisfies Record<
  GameFamily,
  {
    artLabel: string;
    artKicker: string;
    caption: string;
    kicker: string;
    title: string;
    subtitle: string;
    nameLabel: string;
  }
>;

function cleanRoomCode(code: string) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

function isValidRoomCode(code: string) {
  return /^[A-Z0-9]{6,12}$/.test(code);
}
