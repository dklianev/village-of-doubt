import { PHASE_RAIL } from "@/lib/play/phase-display";

export function PhaseRail({ phase }: { phase: string }) {
  return (
    <nav className="phase-rail" aria-label="Фази на играта">
      {PHASE_RAIL.map((step, index) => {
        const active = step.phases.includes(phase);
        return (
          <div key={step.label} className={`phase-rail-step ${active ? "is-active" : ""}`}>
            <span className="phase-rail-index">{String(index + 1).padStart(2, "0")}</span>
            <span className={`phase-rail-icon phase-${step.iconPhase}`} aria-hidden="true" />
            <span className="phase-rail-label">{step.label}</span>
          </div>
        );
      })}
    </nav>
  );
}
