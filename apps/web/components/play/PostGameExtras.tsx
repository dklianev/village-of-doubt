import Link from "next/link";
import type { GameSnapshot } from "@/lib/play/types";
import { canOpenRecordedReplay, historyHrefForGame, repeatGameHref } from "@/lib/play/post-game-links";
import { PostGameStory } from "./PostGameStory";

export interface PostGameExtrasProps {
  section: "actions" | "story";
  snapshot: GameSnapshot;
  recordedGameId: string | null;
  currentUserId: string;
}

export function PostGameExtras({ section, snapshot, recordedGameId, currentUserId }: PostGameExtrasProps) {
  if (section === "story") return <PostGameStory snapshot={snapshot} />;
  const replayEligible = canOpenRecordedReplay(snapshot, currentUserId);
  return (
    <>
      <div className="play-winner-actions">
        <Link className="btn btn-primary" href={repeatGameHref(snapshot)}>
          {snapshot.nextRoomOptions ? "Повтори настройките" : "Нова игра"}
        </Link>
        <Link className="btn btn-secondary" href={historyHrefForGame(recordedGameId, replayEligible)}>
          {recordedGameId && replayEligible ? "Виж записа на играта" : "Към архива"}
        </Link>
      </div>
      <p className="play-winner-repeat-note">{snapshot.nextRoomOptions
        ? "Настройки за нова стая. Участниците се канят отново."
        : "Нова стая с тази игра. Провери настройките и покани участниците отново."}</p>
    </>
  );
}
