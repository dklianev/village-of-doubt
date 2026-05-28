import { useEffect, useRef, type Dispatch } from "react";
import {
  GAME_MODE_DEFINITIONS,
  ROOM_CODE_LENGTH,
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
  timersForState,
  type LobbyFormAction,
  type LobbyFormState,
} from "@/lib/lobby-form";
import { Field } from "@/components/lobby/Field";
import { ManualTempoPanel, formatSeconds, tempoSummary } from "@/components/lobby/ManualTempoPanel";
import { ModeTileCard } from "@/components/lobby/ModeTileCard";
import { QuickStartRow } from "@/components/lobby/QuickStartRow";
import { randomRoomName } from "@/lib/roomname-generator";

const TEMPO_CARDS: { value: TempoProfile; label: string; detail: string }[] = [
  { value: "fast_online", label: "Бърза", detail: "Къси фази за групи, които вече знаят правилата." },
  { value: "normal_online", label: "Нормална", detail: "Най-спокойният избор за онлайн игра." },
  { value: "live", label: "На живо", detail: "По-дълги фази и тих режим за маса в стая." },
  { value: "manual", label: "Ръчно", detail: "Настрой деня, нощта и гласуването като водещ." },
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
  const roomNameRef = useRef<HTMLInputElement | null>(null);
  const didAutoFocus = useRef(false);

  useEffect(() => {
    if (didAutoFocus.current) {
      return;
    }
    if (state.roomName) {
      didAutoFocus.current = true;
      return;
    }
    roomNameRef.current?.focus({ preventScroll: true });
    didAutoFocus.current = true;
  }, [state.roomName]);

  return (
    <section className="lobby-step lobby-step-room" aria-labelledby="step-room-title">
      <div className="lobby-step-heading">
        <p className="step-eyebrow">Стъпка 1 / 4 · Стая</p>
        <h1 id="step-room-title">Създай игра без чудене</h1>
        <p className="step-lede">Започни с готова рецепта или настрой стаята ръчно под нея.</p>
      </div>

      <QuickStartRow state={state} dispatch={dispatch} />

      <div className="lobby-field-grid">
        <Field
          label="Име на стаята"
          hint="Може да го смениш преди поканата."
          actionLabel="Ново име на стаята"
          onAction={() => dispatch({ type: "SET_ROOM_NAME", roomName: randomRoomName(state.family) })}
        >
          <input
            className="field-input"
            ref={roomNameRef}
            value={state.roomName}
            maxLength={42}
            onChange={(event) => dispatch({ type: "SET_ROOM_NAME", roomName: event.target.value })}
          />
        </Field>

        <Field label="Код" hint="6 символа, споделим лесно." actionLabel="Нов код" onAction={() => dispatch({ type: "SET_CODE", code: createRoomCode() })}>
          <input
            className="field-input"
            value={state.code}
            maxLength={ROOM_CODE_LENGTH}
            onChange={(event) => dispatch({ type: "SET_CODE", code: cleanRoomCode(event.target.value) })}
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
          <span className="player-count-badge">{tempoSummary(timersForState(state))}</span>
        </div>
        <div className="tempo-card-grid">
          {(state.mode === "mafia_sport" ? [{ value: "sport_mafia" as const, label: "Спортна", detail: "Фиксирано темпо за 10 играчи." }] : TEMPO_CARDS).map(
            (tempo) => {
              const timers = tempo.value === "manual" ? state.customTimers : TEMPO_PRESETS[tempo.value];
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
        {state.tempoProfile === "manual" && state.mode !== "mafia_sport" ? <ManualTempoPanel state={state} dispatch={dispatch} /> : null}
      </section>
    </section>
  );
}
