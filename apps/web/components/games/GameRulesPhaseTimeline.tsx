"use client";

import { useState, type ReactNode } from "react";
import { phaseLabelBg, type GameMode, type GamePhase } from "@werewolf/shared";

export interface GameRulesPhase {
  id: string;
  phase: GamePhase;
  title: string;
  short: string;
  body: string;
  timer: string;
  wakes: string;
  example: string;
  watch: string;
}

const PHASE_ICONS: Record<GamePhase, string> = {
  lobby: "lobby",
  role_reveal: "role-reveal",
  first_night: "night",
  night: "night",
  day_announcement: "day",
  day_discussion: "day",
  nomination: "voting",
  defense: "voting",
  voting: "voting",
  resolution: "resolution",
  hunter_revenge: "resolution",
  mayor_successor: "resolution",
  paused: "lobby",
  game_over: "resolution",
};

export function GameRulesPhaseTimeline({
  phases,
  mode,
}: {
  phases: GameRulesPhase[];
  mode: GameMode;
}) {
  const firstPhase = phases[0];
  const [activePhaseId, setActivePhaseId] = useState(firstPhase?.id ?? "");
  const artFamily = mode.startsWith("mafia") ? "mafia" : "werewolves";

  if (!firstPhase) {
    return null;
  }

  const activePhase = phases.find((phase) => phase.id === activePhaseId) ?? firstPhase;

  return (
    <section className="phase-timeline-section rules-phase-timeline" aria-labelledby="phase-timeline-title">
      <header className="rules-phase-intro phase-timeline-header">
        <p className="section-kicker">ход на играта</p>
        <h2 id="phase-timeline-title">Фазова карта</h2>
        <p>Натисни фаза, за да видиш кой действа, какъв таймер е подходящ и какво да следиш.</p>
      </header>

      <div className="phase-timeline" role="group" aria-label="Фази">
        {phases.map((phase, index) => (
          <PhaseNode
            key={phase.id}
            phase={phase}
            index={index}
            label={phaseLabelBg(phase.phase, mode)}
            artFamily={artFamily}
            selected={phase.id === activePhase.id}
            onSelect={() => setActivePhaseId(phase.id)}
          />
        ))}
      </div>

      <p className="phase-cycle-note">След развръзката започва нова нощ, докато една страна не спечели.</p>

      <PhaseDetailPanel phase={activePhase} title={phaseLabelBg(activePhase.phase, mode)} />
    </section>
  );
}

function PhaseNode({
  phase,
  index,
  label,
  artFamily,
  selected,
  onSelect,
}: {
  phase: GameRulesPhase;
  index: number;
  label: string;
  artFamily: "mafia" | "werewolves";
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-current={selected ? "step" : undefined}
      aria-controls="phase-detail-panel"
      className={selected ? "phase-node is-selected" : "phase-node"}
      data-phase={phase.phase}
      onClick={onSelect}
    >
      <span className="phase-node-number">{String(index + 1).padStart(2, "0")}</span>
      <img
        className="phase-node-medallion"
        src={`/game-art/phase-board/v1/${artFamily}/icon-phase-${PHASE_ICONS[phase.phase]}-560.webp`}
        alt=""
        loading="lazy"
        decoding="async"
        fetchPriority="low"
        width={560}
        height={560}
      />
      <span className="phase-node-copy">
        <span className="phase-node-label">{label}</span>
        <span className="phase-node-short">{phase.short}</span>
      </span>
    </button>
  );
}

function PhaseDetailPanel({ phase, title }: { phase: GameRulesPhase; title: string }) {
  return (
    <article id="phase-detail-panel" className="phase-detail-panel" key={phase.id} aria-live="polite" aria-atomic="true">
      <div className="phase-detail-panel__lead">
        <p className="section-kicker">{phase.short}</p>
        <h3>{title}</h3>
        <p>{phase.body}</p>
      </div>
      <dl className="phase-info-grid">
        <InfoChip icon={<TimerIcon />} label="Таймер" value={phase.timer} />
        <InfoChip icon={<EyeIcon />} label="Кой се буди" value={phase.wakes} />
        <InfoChip icon={<BulbIcon />} label="Пример" value={phase.example} />
        <InfoChip icon={<TargetIcon />} label="Следи за" value={phase.watch} />
      </dl>
    </article>
  );
}

function InfoChip({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="phase-info-chip">
      <dt>
        <span className="phase-info-chip__icon">{icon}</span>
        {label}
      </dt>
      <dd>{value}</dd>
    </div>
  );
}

function TimerIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="10" cy="11" r="6.2" />
      <path d="M8 3h4M10 11V7.5M10 11l2.4 1.6" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M2.5 10s2.7-4.6 7.5-4.6 7.5 4.6 7.5 4.6-2.7 4.6-7.5 4.6S2.5 10 2.5 10Z" />
      <circle cx="10" cy="10" r="2.1" />
    </svg>
  );
}

function BulbIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M6.4 9.2a3.6 3.6 0 1 1 7.2 0c0 1.5-.8 2.4-1.7 3.2-.5.5-.8 1-.8 1.8H8.9c0-.8-.3-1.3-.8-1.8-.9-.8-1.7-1.7-1.7-3.2Z" />
      <path d="M8.7 16h2.6M8.9 14.2h2.2" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="6.5" />
      <circle cx="10" cy="10" r="3.3" />
      <path d="M10 2.2v2M10 15.8v2M2.2 10h2M15.8 10h2" />
    </svg>
  );
}
