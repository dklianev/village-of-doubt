"use client";

import {
  ROLE_DEFINITIONS,
  getGameModeNameBg,
  type CommunicationMode,
  type NarratorMode,
  type RoleCode,
} from "@werewolf/shared";
import type { Dispatch } from "react";
import {
  currentConfig,
  formatEstimatedDuration,
  hrefForState,
  estimatedDurationSeconds,
  type LobbyFormAction,
  type LobbyFormState,
} from "@/lib/lobby-form";
import { roleThumbStyle } from "@/lib/role-art";

const NARRATOR_LABELS: Record<NarratorMode, string> = {
  automatic: "Автоматичен",
  honest_human: "Честен",
  full_human: "Пълен",
};

const COMMUNICATION_LABELS: Record<CommunicationMode, string> = {
  built_in_chat: "Вграден чат",
  no_chat: "Без чат",
  system_only: "Само системни",
  secret_channels: "Тайни канали",
};

export function StepPreview({
  state,
  dispatch,
  onSubmit,
}: {
  state: LobbyFormState;
  dispatch: Dispatch<LobbyFormAction>;
  onSubmit: (href: string) => void;
}) {
  const config = currentConfig(state);
  const playHref = hrefForState("/play", state);
  const lobbyHref = hrefForState("/lobby", state);

  return (
    <section className="lobby-step lobby-step-preview" aria-labelledby="step-preview-title">
      <div className="lobby-step-heading">
        <p className="section-kicker">стъпка 4</p>
        <h1 id="step-preview-title">{getGameModeNameBg(state.mode)}</h1>
        <p>{state.roomName} · {formatEstimatedDuration(estimatedDurationSeconds(state))}</p>
      </div>

      <div className="preview-stats-grid">
        <Summary label="Играчи" value={`${config.playerCount}/${config.maxPlayers}`} />
        <Summary label="Режим" value={getGameModeNameBg(state.mode)} />
        <Summary label="Разказвач" value={NARRATOR_LABELS[state.narratorMode]} />
        <Summary label="Комуникация" value={COMMUNICATION_LABELS[state.communicationMode]} />
        <Summary label="Темпо" value={`${config.timers.dayDiscussionSeconds}/${config.timers.factionNightActionSeconds}/${config.timers.voteSeconds} сек.`} />
        <Summary label="Продължителност" value={formatEstimatedDuration(estimatedDurationSeconds(state))} />
      </div>

      <div className="preview-role-grid">
        {Object.entries(config.roles).map(([role, count]) => (
          <span key={role} className={`role-count-chip role-${role}`}>
            <span className="role-count-art" aria-hidden="true" style={roleThumbStyle(state.family, role as RoleCode)} />
            <strong>{ROLE_DEFINITIONS[role as RoleCode].nameBg}</strong>
            <b>{count}</b>
          </span>
        ))}
      </div>

      <div className="preview-action-row">
        <button type="button" className="btn btn-primary" onClick={() => onSubmit(playHref)}>
          Създай и влез
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => void shareInvite(lobbyHref, state.roomName, dispatch)}>
          Сподели покана
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => onSubmit(lobbyHref)}>
          Прегледай лоби
        </button>
      </div>
    </section>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

async function shareInvite(href: string, roomName: string, dispatch: Dispatch<LobbyFormAction>) {
  const url = new URL(href, window.location.origin).toString();
  if (navigator.share) {
    await navigator.share({ title: roomName || "Покана за игра", url }).catch(() => {});
    return;
  }

  await navigator.clipboard.writeText(url).catch(() => {});
  dispatch({ type: "SET_FORM_ERROR", formError: "Поканата е копирана." });
}
