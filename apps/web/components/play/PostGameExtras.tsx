import { useMemo } from "react";
import { ButtonLink } from "@/components/button-link";
import type { GameSnapshot } from "@/lib/play/types";
import { withNextRoomOptions } from "@/lib/play/next-room-options";
import { canOpenRecordedReplay, historyHrefForGame, repeatGameHref } from "@/lib/play/post-game-links";
import { PostGameStory } from "./PostGameStory";

export interface PostGameExtrasProps {
  section: "actions" | "story";
  snapshot: GameSnapshot;
  recordedGameId: string | null;
  currentUserId: string;
}

export function PostGameExtras({ section, snapshot: rawSnapshot, recordedGameId, currentUserId }: PostGameExtrasProps) {
  const snapshot = useMemo(() => withNextRoomOptions(rawSnapshot), [rawSnapshot]);
  if (section === "story") return <PostGameStory snapshot={snapshot} />;
  const replayEligible = canOpenRecordedReplay(snapshot, currentUserId);
  return (
    <>
      <div className="play-winner-actions">
        <ButtonLink href={repeatGameHref(snapshot)}>
          {snapshot.nextRoomOptions ? "Повтори настройките" : "Нова игра"}
        </ButtonLink>
        <ButtonLink variant="secondary" href={historyHrefForGame(recordedGameId, replayEligible)}>
          {recordedGameId && replayEligible ? "Виж записа на играта" : "Към архива"}
        </ButtonLink>
      </div>
      <p className="play-winner-repeat-note">{snapshot.nextRoomOptions
        ? "Настройки за нова стая. Участниците се канят отново."
        : "Нова стая с тази игра. Провери настройките и покани участниците отново."}</p>
    </>
  );
}
