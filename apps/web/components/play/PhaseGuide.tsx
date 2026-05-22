import type { GameMode, GamePhase, RoleCode } from "@werewolf/shared";
import { phaseGuideBg, roleWakeHint } from "@/lib/play/copy";
import type { PublicPlayer } from "@/lib/play/types";

export function PhaseGuide({
  phase,
  mode,
  privateRole,
  ownPlayer,
}: {
  phase: GamePhase;
  mode: GameMode;
  privateRole: RoleCode | undefined;
  ownPlayer: PublicPlayer | undefined;
}) {
  const guide = phaseGuideBg(phase, mode);
  const personalHint = privateRole ? roleWakeHint(privateRole, phase, ownPlayer) : "Ролята ти още не е разкрита на това устройство.";

  return (
    <section className="phase-guide-card ritual-panel mt-8 rounded-[2rem] p-6">
      <p className="section-kicker">водене на рунда</p>
      <h2 className="mt-2 text-3xl font-black">{guide.title}</h2>
      <p className="mt-3 text-[#ead9ba]">{guide.body}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl bg-[#f4e8d1]/10 px-4 py-3">
          <span className="block text-xs uppercase tracking-[0.2em] text-[#c18a38]">кой се буди</span>
          <strong className="mt-1 block">{guide.wakes}</strong>
        </div>
        <div className="rounded-2xl bg-[#f4e8d1]/10 px-4 py-3">
          <span className="block text-xs uppercase tracking-[0.2em] text-[#c18a38]">за теб</span>
          <strong className="mt-1 block">{personalHint}</strong>
        </div>
      </div>
    </section>
  );
}
