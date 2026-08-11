import {
  getGameFamily,
  type CommunicationMode,
  type CreateRoomOptions,
  type MajorityMode,
  type NarratorMode,
  type NarratorVoice,
  type RoleDistribution,
  type TempoProfile,
} from "@werewolf/shared";
import { roomOptionsToQuery } from "@/lib/room-options-query";
import type { GameSnapshot } from "@/lib/play/types";

export function repeatGameHref(snapshot: GameSnapshot) {
  const roles = Object.fromEntries(
    snapshot.roleCounts
      .filter(({ count }) => count > 0)
      .map(({ role, count }) => [role, count]),
  ) as RoleDistribution;
  const hasPublicComposition = Object.keys(roles).length > 0;
  const options: CreateRoomOptions = {
    mode: snapshot.mode,
    playerCount: snapshot.playerCount,
    maxPlayers: snapshot.playerCount,
    communicationMode: snapshot.communicationMode as CommunicationMode,
    narratorMode: snapshot.narratorMode as NarratorMode,
    tempoProfile: snapshot.tempoProfile as TempoProfile,
    revealRolesOnDeath: snapshot.revealRolesOnDeath,
    loversEnabled: snapshot.loversEnabled,
    allowSkipVote: snapshot.allowSkipVote,
    majorityMode: snapshot.majorityMode as MajorityMode,
    narratorVoice: snapshot.narratorVoice as NarratorVoice,
    ...(typeof snapshot.doctorCanSelfProtect === "boolean"
      ? { doctorCanSelfProtect: snapshot.doctorCanSelfProtect }
      : {}),
    ...(hasPublicComposition ? { rolePreset: "manual", roles } : {}),
  };
  const family = getGameFamily(snapshot.mode);
  return `/${family === "mafia" ? "mafia" : "werewolf"}/create${roomOptionsToQuery(options)}`;
}

export function historyHrefForGame(gameId: string | null) {
  return gameId ? `/history/${encodeURIComponent(gameId)}/replay` : "/history";
}
