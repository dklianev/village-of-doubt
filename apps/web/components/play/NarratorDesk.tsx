import type { Room } from "@colyseus/sdk";
import { Keyboard, Pause, Plus, SkipForward } from "lucide-react";
import type { GameFamily, GamePhase } from "@werewolf/shared";
import { SummaryPill } from "@/components/play/SummaryPill";
import { Timer } from "@/components/play/Timer";
import { narratorBg } from "@/lib/play/copy";
import { phaseBg } from "@/lib/play/phase-display";
import type { GameSnapshot } from "@/lib/play/types";

export function NarratorDesk({
  room,
  snapshot,
  phase,
  family,
  isNarrator,
  onOpenShortcuts,
}: {
  room: Room | null;
  snapshot: GameSnapshot;
  phase: GamePhase;
  family: GameFamily;
  isNarrator: boolean;
  onOpenShortcuts: () => void;
}) {
  const pendingConsent = snapshot.players.filter((player) => !player.acceptedFullNarrator).length;
  const activePlayers = snapshot.players.filter((player) => player.playing);
  const actedCount = activePlayers.filter((player) => player.actedThisPhase).length;
  const votedCount = activePlayers.filter((player) => player.hasVoted).length;

  return (
    <section className="narrator-desk mt-8 rounded-[2rem] p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="section-kicker">панел на Разказвача</p>
          <h2 className="mt-2 text-3xl font-black">{isNarrator ? "Водиш играта" : "Контрол на водещия"}</h2>
          <p className="mt-3 max-w-2xl text-[#ead9ba]">
            Управлявай темпото без скрити клиентски решения. Всички действия се записват като събития за проверка на Разказвача.
          </p>
        </div>
        <div className="narrator-phase-seal">
          <span>{phaseBg(phase, family)}</span>
          <Timer endsAt={snapshot.phaseEndsAt} />
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <SummaryPill label="Активни" value={`${activePlayers.length}/${snapshot.playerCount}`} />
        <SummaryPill label="Действали" value={`${actedCount}/${activePlayers.length}`} />
        <SummaryPill label="Гласували" value={`${votedCount}/${activePlayers.length}`} />
        <SummaryPill label="Режим" value={narratorBg(snapshot.narratorMode)} />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button className="btn btn-secondary" type="button" onClick={() => room?.send("narratorPause")} disabled={!room || phase === "paused"}>
          <Pause className="play-button-icon" aria-hidden strokeWidth={1.8} />
          Пауза
        </button>
        <button className="btn btn-primary" type="button" onClick={() => room?.send("narratorAdvance")} disabled={!room}>
          <SkipForward className="play-button-icon" aria-hidden strokeWidth={1.8} />
          Следваща фаза
        </button>
        {[30, 60, 180].map((seconds) => (
          <button
            key={seconds}
            className="btn btn-secondary"
            type="button"
            onClick={() => room?.send("narratorExtendTimer", { seconds })}
            disabled={!room || phase === "paused" || phase === "game_over"}
          >
            <Plus className="play-button-icon" aria-hidden strokeWidth={1.8} />
            +{seconds} сек.
          </button>
        ))}
        <button className="btn btn-secondary" type="button" onClick={onOpenShortcuts}>
          <Keyboard className="play-button-icon" aria-hidden strokeWidth={1.8} />
          Клавишни команди
        </button>
      </div>

      {snapshot.narratorMode === "full_human" && pendingConsent > 0 ? (
        <p className="mt-5 rounded-2xl bg-[#842f2b]/25 p-4 font-bold text-[#fff6e5]">
          Изчакват се {pendingConsent} играчи да приемат, че Пълният Разказвач вижда всички роли.
        </p>
      ) : null}
    </section>
  );
}
