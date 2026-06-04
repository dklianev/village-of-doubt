import { getGameFamily, type GameMode, type GamePhase, type NarratorVoice } from "@werewolf/shared";
import { phaseBg, phaseNarratorLine, phaseSigil } from "@/lib/play/phase-display";

function transitionKindForPhase(phase: GamePhase) {
  if (phase === "role_reveal") {
    return "role";
  }

  if (phase === "night" || phase === "first_night") {
    return "night";
  }

  if (phase === "day_announcement" || phase === "day_discussion" || phase === "nomination" || phase === "defense") {
    return "day";
  }

  if (phase === "voting") {
    return "vote";
  }

  return "resolution";
}

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

  const family = getGameFamily(mode);
  const transitionKind = transitionKindForPhase(phase);

  return (
    <div
      key={`${phase}-${pulseKey}`}
      className={`phase-transition-overlay transition-${phase}`}
      data-family={family}
      data-phase={phase}
      data-transition-kind={transitionKind}
      aria-hidden="true"
    >
      <div>
        <span>{phaseSigil(phase)}</span>
        <strong>{phaseBg(phase, mode)}</strong>
        <small>{phaseNarratorLine(phase, mode, narratorVoice)}</small>
      </div>
    </div>
  );
}
