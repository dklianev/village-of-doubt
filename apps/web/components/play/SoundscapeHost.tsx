import { useEffect, useRef } from "react";
import { playSoundStinger, setSoundScene } from "@/lib/play/soundscape-bridge";
import { readNarrationTerminalResult } from "@/lib/play/narration-cues";
import type { CueMode, GameSnapshot } from "@/lib/play/types";

/**
 * Feeds the table soundscape from public state only. Lazy, so neither this wiring nor the
 * synthesiser sits in the play room's entry chunk. Live tables stay silent: a sound at night
 * could reveal who is acting. Like the phase cues, it plays only when this device chose
 * "Звук и вибрация" for the table.
 */
export function SoundscapeHost({
  snapshot,
  room,
  connected,
  liveMode,
  cueMode,
}: {
  snapshot: Pick<GameSnapshot, "mode" | "phase" | "round" | "votingCycle" | "narratorVoice" | "winnerTeam" | "players" | "publicEvents">;
  room: { roomId: string; state: unknown } | null;
  connected: boolean;
  liveMode: boolean;
  cueMode: CueMode;
}) {
  const activeRoom = useRef(room);
  const seenEvents = useRef<{ room: typeof room; connected: boolean; ids: Set<string> } | null>(null);
  const silent = !connected || !room || liveMode || cueMode !== "audio_vibration";

  useEffect(() => {
    if (activeRoom.current !== room) setSoundScene(null);
    activeRoom.current = room;
    if (silent || !room) { setSoundScene(null); return; }
    setSoundScene({
      mode: snapshot.mode,
      phase: snapshot.phase,
      narratorVoice: snapshot.narratorVoice ?? "classic",
      narration: {
        gameId: room.roomId,
        round: snapshot.round,
        votingCycle: snapshot.votingCycle,
        winnerTeam: snapshot.winnerTeam,
        participantIds: snapshot.players.filter((player) => player.playing).map((player) => player.userId),
        ...readNarrationTerminalResult(room, room.roomId, snapshot.round),
      },
    });
  }, [silent, room, snapshot]);

  useEffect(() => () => {
    seenEvents.current = null;
    setSoundScene(null);
  }, []);

  // Events already present when the table mounts (join, reconnect) are history, not news.
  useEffect(() => {
    const previous = seenEvents.current;
    seenEvents.current = { room, connected, ids: new Set(snapshot.publicEvents.map((event) => event.id)) };
    if (!previous || silent || !previous.connected || previous.room !== room) return;
    if (snapshot.publicEvents.some((event) => !previous.ids.has(event.id) && (event.type === "death" || event.type === "hunter_shot"))) {
      playSoundStinger("death");
    }
  }, [silent, connected, room, snapshot.publicEvents]);

  return null;
}
