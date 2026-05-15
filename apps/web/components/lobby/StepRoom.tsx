"use client";

import { useState, type Dispatch, type ReactNode } from "react";
import {
  GAME_MODE_DEFINITIONS,
  getGameModeNameBg,
  TEMPO_PRESETS,
  type GameMode,
  type TempoProfile,
} from "@werewolf/shared";
import {
  availableModes,
  boundedPlayerCount,
  cleanRoomCode,
  createRoomCode,
  playerRange,
  roomCodeValidationMessage,
  type LobbyFormAction,
  type LobbyFormState,
} from "@/lib/lobby-form";
import { ModeTileCard } from "@/components/lobby/ModeTileCard";
import { QuickStartRow } from "@/components/lobby/QuickStartRow";
import { randomRoomName } from "@/lib/roomname-generator";
import { validateDisplayNameBg } from "@/lib/anonymous-player";

const TEMPO_CARDS: { value: TempoProfile; label: string; detail: string }[] = [
  { value: "fast_online", label: "Бърза", detail: "Къси фази за групи, които вече знаят правилата." },
  { value: "normal_online", label: "Нормална", detail: "Най-спокойният избор за онлайн игра." },
  { value: "live", label: "На живо", detail: "По-дълги фази и тих режим за маса в стая." },
];

export function StepRoom({
  state,
  dispatch,
}: {
  state: LobbyFormState;
  dispatch: Dispatch<LobbyFormAction>;
}) {
  const range = playerRange(state.mode);
  const players = boundedPlayerCount(state);
  const modes = availableModes(state.family);
  const [displayNameBlurred, setDisplayNameBlurred] = useState(false);
  const [codeBlurred, setCodeBlurred] = useState(false);
  const displayNameError =
    displayNameBlurred && state.displayName.trim().length > 0 ? validateDisplayNameBg(state.displayName) : "";
  const codeError = codeBlurred ? roomCodeValidationMessage(state.code) : "";

  return (
    <section className="lobby-step lobby-step-room" aria-labelledby="step-room-title">
      <QuickStartRow dispatch={dispatch} />
      <div className="lobby-step-heading">
        <p className="step-eyebrow">Стъпка 1 / 4 · Стая</p>
        <h1 id="step-room-title">Създай частна стая</h1>
        <p className="step-lede">Избери име, код, игра и темпо.</p>
      </div>

      <div className="lobby-field-grid">
        <Field label="Потребителско име" hint="Между 2 и 24 символа." error={displayNameError}>
          <input
            className="field-input"
            value={state.displayName}
            maxLength={24}
            autoFocus
            onChange={(event) => dispatch({ type: "SET_DISPLAY_NAME", displayName: event.target.value })}
            onBlur={() => setDisplayNameBlurred(true)}
            placeholder="Например: Мила"
          />
        </Field>

        <Field
          label="Име на стаята"
          hint="Може да го смениш преди поканата."
          actionLabel="Ново име на стаята"
          onAction={() => dispatch({ type: "SET_ROOM_NAME", roomName: randomRoomName(state.family) })}
        >
          <input
            className="field-input"
            value={state.roomName}
            maxLength={42}
            onChange={(event) => dispatch({ type: "SET_ROOM_NAME", roomName: event.target.value })}
          />
        </Field>

        <Field
          label="Код"
          hint="6-12 символа, споделим лесно."
          error={codeError}
          actionLabel="Нов код"
          onAction={() => dispatch({ type: "SET_CODE", code: createRoomCode() })}
        >
          <input
            className="field-input"
            value={state.code}
            maxLength={12}
            onChange={(event) => dispatch({ type: "SET_CODE", code: cleanRoomCode(event.target.value) })}
            onBlur={() => setCodeBlurred(true)}
          />
        </Field>
      </div>

      <section className="lobby-panel">
        <div className="lobby-panel-title">
          <h2>Режим</h2>
          {state.lockedFamily ? <span className="locked-mode-badge">{getGameModeNameBg(state.mode)}</span> : null}
        </div>
        {state.lockedFamily ? (
          <div className="locked-mode-card">
            <strong>{getGameModeNameBg(state.mode)}</strong>
            <span>{GAME_MODE_DEFINITIONS[state.mode].shortBg}</span>
          </div>
        ) : (
          <div className="mode-tile-grid">
            {modes.map((mode) => (
              <ModeTileCard
                key={mode}
                mode={mode}
                active={state.mode === mode}
                onSelect={(nextMode: GameMode) => dispatch({ type: "SET_MODE", mode: nextMode })}
              />
            ))}
          </div>
        )}
      </section>

      <section className="lobby-panel">
        <div className="lobby-panel-title">
          <h2>Брой играчи</h2>
          <span className="player-count-badge">{players} играчи</span>
        </div>
        {state.mode === "mafia_sport" ? (
          <p className="fixed-player-count">Точно 10 играчи</p>
        ) : (
          <div className="player-count-control">
            <button type="button" onClick={() => dispatch({ type: "SET_PLAYER_COUNT", playerCount: players - 1 })}>
              -
            </button>
            <input
              type="range"
              min={range.min}
              max={range.max}
              value={players}
              onChange={(event) => dispatch({ type: "SET_PLAYER_COUNT", playerCount: Number(event.target.value) })}
            />
            <button type="button" onClick={() => dispatch({ type: "SET_PLAYER_COUNT", playerCount: players + 1 })}>
              +
            </button>
          </div>
        )}
        <div className="player-dot-row" aria-hidden="true">
          {Array.from({ length: Math.min(range.max, 30) }, (_, index) => (
            <i key={index} data-filled={index < players} />
          ))}
        </div>
      </section>

      <section className="lobby-panel">
        <div className="lobby-panel-title">
          <h2>Темпо</h2>
        </div>
        <div className="tempo-card-grid">
          {(state.mode === "mafia_sport" ? [{ value: "sport_mafia" as const, label: "Спортна", detail: "Фиксирано темпо за 10 играчи." }] : TEMPO_CARDS).map(
            (tempo) => {
              const timers = TEMPO_PRESETS[tempo.value];
              return (
                <button
                  key={tempo.value}
                  type="button"
                  className="tempo-tile"
                  data-active={state.tempoProfile === tempo.value}
                  onClick={() => dispatch({ type: "SET_TEMPO_PROFILE", tempoProfile: tempo.value })}
                >
                  <strong>{tempo.label}</strong>
                  <span>{tempo.detail}</span>
                  <small>
                    Ден {timers.dayDiscussionSeconds} · Нощ {timers.factionNightActionSeconds} · Гласуване {timers.voteSeconds} сек.
                  </small>
                </button>
              );
            },
          )}
        </div>
      </section>
    </section>
  );
}

export function Field({
  label,
  hint,
  error = "",
  actionLabel,
  onAction,
  children,
}: {
  label: string;
  hint: string;
  error?: string;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-input-wrap" data-has-action={Boolean(onAction)}>
        {children}
        {onAction ? (
          <button type="button" className="field-action" aria-label={actionLabel} title={actionLabel} onClick={onAction}>
            <RefreshIcon />
          </button>
        ) : null}
      </span>
      {error ? (
        <span className="field-error" role="alert">
          ⚠ {error}
        </span>
      ) : (
        <span className="field-hint">{hint}</span>
      )}
    </label>
  );
}

function RefreshIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none">
      <path d="M3 12a9 9 0 0 1 15.1-6.6L21 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 3v5h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 12a9 9 0 0 1-15.1 6.6L3 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 21v-5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
