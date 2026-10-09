import Link from "next/link";
import { Check, Play, Users } from "lucide-react";
import type { GameFamily } from "@werewolf/shared";
import type { ReactNode } from "react";
import { Button } from "@/components/button";
import type { PublicEvent, PublicPlayer } from "@/lib/play/types";
import { PublicEventLine } from "./PublicEventLine";

export function PlayLobbyBand({ players, ownPlayer, latestEvent, family, connected, starting,
  startDisabledReason, onReady, onStart, tools }: {
  players: PublicPlayer[];
  ownPlayer: PublicPlayer | undefined;
  latestEvent: PublicEvent | undefined;
  family: GameFamily;
  connected: boolean;
  starting: boolean;
  startDisabledReason: string | null;
  onReady: () => void;
  onStart: () => void;
  tools: ReactNode;
}) {
  const participants = players.filter((player) => player.playing);
  const readyCount = participants.filter((player) => player.ready).length;
  const allReady = participants.length > 0 && participants.every((player) => player.ready && player.connected);
  return <section className="play-waiting-band" aria-label="Подготовка за играта">
    {latestEvent ? <div className="play-waiting-activity"><PublicEventLine event={latestEvent} /></div> : null}
    <div className="play-waiting-controls">
      <div className="play-waiting-readiness" role="status" aria-atomic="true" aria-label={`Готови: ${readyCount} от ${participants.length}`}>
        {allReady ? <Check aria-hidden="true" /> : <Users aria-hidden="true" />}
        <div><strong>{readyCount} от {participants.length} са готови</strong>
          <p>{allReady ? "Всички са на масата." : participants.some((player) => !player.connected) ? "Чакаме връзката на участник." : "Компанията се събира."}</p>
        </div>
      </div>
      <div className="play-waiting-actions">
        <div className="play-lobby-ready-actions">
          {ownPlayer?.playing ? <Button
            data-testid="ready-toggle"
            variant={ownPlayer.ready || ownPlayer.host ? "secondary" : "primary"}
            onClick={onReady} disabled={!connected} aria-pressed={ownPlayer.ready}
          >
            <Users className="play-button-icon" aria-hidden strokeWidth={1.8} />
            {ownPlayer.ready ? "Не съм готов" : "Готов"}
          </Button> : null}
          {ownPlayer?.host ? <Button
            onClick={onStart}
            disabled={startDisabledReason !== null}
            aria-describedby={startDisabledReason ? "play-start-disabled-reason" : undefined}
          >
            <Play className="play-button-icon" aria-hidden strokeWidth={1.8} />
            {starting ? "Започваме..." : "Започни игра"}
          </Button> : null}
        </div>
        {ownPlayer?.host && startDisabledReason ? <p id="play-start-disabled-reason" className="play-start-disabled-reason" role="status">{startDisabledReason}</p> : null}
        {!ownPlayer?.host ? <p className="play-waiting-note">{ownPlayer?.playing ? "Домакинът започва играта." : "Наблюдаваш масата."}</p> : null}
      </div>
      <div className="play-waiting-tools">
        <div>{tools}</div>
        <Link href={family === "mafia" ? "/mafia" : "/werewolf"} className="play-waiting-leave">Напусни масата</Link>
      </div>
    </div>
    {ownPlayer?.host && participants.some((player) => !player.ready) ? <p className="play-waiting-note">Не всички са готови. Като домакин можеш да започнеш и без потвърждението им.</p> : null}
  </section>;
}
