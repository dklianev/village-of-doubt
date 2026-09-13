"use client";

import { useMemo } from "react";
import { Check, Gavel, Mic2, ShieldCheck } from "lucide-react";
import type { GamePhase } from "@werewolf/shared";
import { ProfilePortrait } from "@/components/ProfilePortrait";
import { avatarIdForUser } from "@/lib/avatar-catalog";
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
  onSelectNominee?: ((targetUserId: string) => void) | undefined;
  selectableNomineeIds?: ReadonlySet<string>;
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
  onSelectNominee,
  selectableNomineeIds,
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
  const interactive = phase === "voting" && Boolean(onSelectNominee);

  return (
    <section
      className="play-nomination-panel grid"
      aria-labelledby="sport-nomination-heading"
      data-testid="nomination-panel"
    >
      <div className={`flex items-center gap-3 ${phase === "voting" ? "sr-only" : ""}`}>
        <HeadingIcon className="h-5 w-5" aria-hidden strokeWidth={1.9} />
        <h3 id="sport-nomination-heading">{heading}</h3>
      </div>

      {canNominate ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-bold" aria-live="polite">
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
        <p className="text-xs font-black uppercase">Номинирани</p>
        {uniqueNominees.length > 0 ? (
          <ol className="mt-2 flex flex-wrap gap-2" data-selectable={interactive || undefined}>
            {uniqueNominees.map((player, index) => (
              <li
                key={player.userId}
                className="text-sm"
              >
                {interactive ? (
                  <button
                    type="button"
                    className="play-nominee-choice"
                    aria-label={`Избери ${player.displayName} за гласуване`}
                    aria-pressed={selectedTargetId === player.userId}
                    disabled={!selectableNomineeIds?.has(player.userId)}
                    title={!selectableNomineeIds?.has(player.userId) ? "Не можеш да гласуваш за този играч." : undefined}
                    onClick={() => onSelectNominee?.(player.userId)}
                  >
                    <ProfilePortrait avatarId={player.avatarId ?? avatarIdForUser(player.userId)} decorative className="play-nominee-portrait" />
                    <span>{player.displayName}</span>
                    <Check className="play-nominee-check" aria-hidden />
                  </button>
                ) : <>{index + 1}. {player.displayName}</>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm">Няма подадени номинации.</p>
        )}
      </div>
    </section>
  );
}
