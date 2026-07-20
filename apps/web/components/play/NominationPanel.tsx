"use client";

import { useMemo } from "react";
import { Gavel, Mic2, ShieldCheck } from "lucide-react";
import type { GamePhase } from "@werewolf/shared";
import type { PublicNomination, PublicPlayer } from "@/lib/play/types";

interface NominationPanelProps {
  phase: GamePhase;
  players: PublicPlayer[];
  currentUserId: string;
  currentSpeakerUserId: string;
  currentDefenseUserId: string;
  nominations: PublicNomination[];
  canNominate: boolean;
  selectedTargetId: string;
  onNominate: (targetUserId: string) => void;
}

export function NominationPanel({
  phase,
  players,
  currentUserId,
  currentSpeakerUserId,
  currentDefenseUserId,
  nominations,
  canNominate,
  selectedTargetId,
  onNominate,
}: NominationPanelProps) {
  const playerById = useMemo(
    () => new Map(players.map((player) => [player.userId, player])),
    [players],
  );
  const currentNomination = nominations.find((item) => item.nominatorUserId === currentUserId);
  const selectedTarget = playerById.get(selectedTargetId);
  const uniqueNominees = useMemo(() => {
    const seen = new Set<string>();
    return nominations.flatMap((nomination) => {
      if (seen.has(nomination.targetUserId)) {
        return [];
      }
      const target = playerById.get(nomination.targetUserId);
      if (!target?.playing || !target.alive) {
        return [];
      }
      seen.add(nomination.targetUserId);
      return [target];
    });
  }, [nominations, playerById]);

  const speaker = playerById.get(currentSpeakerUserId);
  const defender = playerById.get(currentDefenseUserId);
  const heading = phase === "day_discussion"
    ? speaker
      ? `Говори ${speaker.displayName}`
      : "Дневни речи"
    : phase === "nomination"
      ? "Преглед на номинациите"
      : phase === "defense"
        ? defender
          ? `Защитава се ${defender.displayName}`
          : "Защити на номинираните"
        : "Гласуване сред номинираните";
  const HeadingIcon = phase === "day_discussion" ? Mic2 : phase === "defense" ? ShieldCheck : Gavel;

  return (
    <section
      className="grid gap-4 rounded-lg border border-[#d19a42]/35 bg-black/20 p-4"
      aria-labelledby="sport-nomination-heading"
      data-testid="nomination-panel"
    >
      <div className="flex items-center gap-3">
        <HeadingIcon className="h-5 w-5 text-[#e7b667]" aria-hidden strokeWidth={1.9} />
        <div>
          <p className="text-xs font-black uppercase text-[#d7a552]">дневен ред</p>
          <h3 id="sport-nomination-heading" className="text-lg font-black text-[#fff7df]">{heading}</h3>
        </div>
      </div>

      {canNominate ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-bold text-[#f5e8c8]" aria-live="polite">
            {selectedTarget
              ? `Избрана номинация: ${selectedTarget.displayName}`
              : currentNomination
                ? `Текуща номинация: ${playerById.get(currentNomination.targetUserId)?.displayName ?? "неизвестен играч"}`
                : "Няма избрана седалка."}
          </p>
          <button
            className="btn btn-primary min-h-11"
            type="button"
            disabled={!selectedTargetId}
            onClick={() => selectedTargetId && onNominate(selectedTargetId)}
          >
            <Gavel className="play-button-icon" aria-hidden strokeWidth={1.9} />
            {currentNomination ? "Смени" : "Номинирай"}
          </button>
        </div>
      ) : null}

      <div aria-live="polite">
        <p className="text-xs font-black uppercase text-[#d7a552]">Номинирани</p>
        {uniqueNominees.length > 0 ? (
          <ol className="mt-2 flex flex-wrap gap-2">
            {uniqueNominees.map((player, index) => (
              <li
                key={player.userId}
                className="rounded-md border border-[#f5e8c8]/20 bg-[#f5e8c8]/10 px-3 py-2 text-sm font-bold text-[#fff7df]"
              >
                {index + 1}. {player.displayName}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-[#ead9ba]">Няма подадени номинации.</p>
        )}
      </div>
    </section>
  );
}
