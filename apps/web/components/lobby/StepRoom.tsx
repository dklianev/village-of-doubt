"use client";

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
  type LobbyFormAction,
  type LobbyFormState,
} from "@/lib/lobby-form";
import { ModeTileCard } from "@/components/lobby/ModeTileCard";
import { QuickStartRow } from "@/components/lobby/QuickStartRow";
import type { Dispatch } from "react";
import { randomRoomName } from "@/lib/roomname-generator";

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

  return (
    <section className="lobby-step lobby-step-room" aria-labelledby="step-room-title">
      <QuickStartRow dispatch={dispatch} />
      <div className="lobby-step-heading">
        <p className="section-kicker">стъпка 1</p>
        <h1 id="step-room-title">Създай частна стая</h1>
        <p>Избери име, код, игра и темпо. Настройките после се записват в поканата.</p>
      </div>

      <div className="lobby-field-grid">
        <label className="lobby-field">
          <span>Потребителско име</span>
          <input
            className="input"
            value={state.displayName}
            maxLength={24}
            autoFocus
            onChange={(event) => dispatch({ type: "SET_DISPLAY_NAME", displayName: event.target.value })}
            placeholder="Например: Мила"
          />
          <small>{state.displayName.trim().length < 2 ? "Нужно е име между 2 и 24 символа." : "Името е готово."}</small>
        </label>

        <label className="lobby-field">
          <span>Име на стаята</span>
          <div className="lobby-inline-control">
            <input
              className="input"
              value={state.roomName}
              maxLength={42}
              onChange={(event) => dispatch({ type: "SET_ROOM_NAME", roomName: event.target.value })}
            />
            <button type="button" className="btn btn-secondary" onClick={() => dispatch({ type: "SET_ROOM_NAME", roomName: randomRoomName(state.family) })}>
              Случайно
            </button>
          </div>
        </label>

        <label className="lobby-field">
          <span>Код</span>
          <div className="lobby-inline-control">
            <input
              className="input"
              value={state.code}
              maxLength={12}
              onChange={(event) => dispatch({ type: "SET_CODE", code: cleanRoomCode(event.target.value) })}
            />
            <button type="button" className="btn btn-secondary" onClick={() => dispatch({ type: "SET_CODE", code: createRoomCode() })}>
              Нов
            </button>
          </div>
        </label>
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
