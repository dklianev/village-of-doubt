import type { GameMode, GamePhase, NarratorVoice } from "@werewolf/shared";
import { phaseBg, phaseNarratorLine, phaseSigil } from "@/lib/play/phase-display";

export function PhaseTransitionOverlay({
  phase,
  mode,
  narratorVoice,
  pulseKey,
}: {
  phase: GamePhase;
  mode: GameMode;
  narratorVoice: NarratorVoice;
  pulseKey: number;
}) {
  if (pulseKey === 0 || phase === "lobby") {
    return null;
  }

  return (
    <div key={`${phase}-${pulseKey}`} className={`phase-transition-overlay transition-${phase}`} aria-hidden="true">
      <div>
        <span>{phaseSigil(phase)}</span>
        <strong>{phaseBg(phase, mode)}</strong>
        <small>{phaseNarratorLine(phase, mode, narratorVoice)}</small>
      </div>
    </div>
  );
}
