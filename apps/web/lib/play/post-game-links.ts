import {
  createGameConfigFromOptions,
  createRoomOptionsFromConfig,
  getGameFamily,
  type CommunicationMode,
  type CreateRoomOptions,
  type MajorityMode,
  type NarratorMode,
  type NarratorVoice,
  type RoleDistribution,
  type TempoProfile,
} from "@werewolf/shared";
import { loversAvailableFor } from "@/lib/lobby-form/preset-policy";
import { roomOptionsToQuery } from "@/lib/room-options-query";
import type { GameSnapshot } from "@/lib/play/types";

export function repeatGameHref(snapshot: GameSnapshot) {
  if (snapshot.nextRoomOptions) {
    const { code: _code, spectator: _spectator, roles, ...setup } = snapshot.nextRoomOptions;
    const options: CreateRoomOptions = roles && !canPreserveRepeatPreset(setup, roles)
      ? { ...setup, rolePreset: "manual", roles }
      : setup;
    const family = getGameFamily(options.mode ?? snapshot.mode);
    return `/${family === "mafia" ? "mafia" : "werewolf"}/create${roomOptionsToQuery(options)}`;
  }
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
    ...(snapshot.tempoProfile === "manual" ? {
      customTimers: {
        dayDiscussionSeconds: snapshot.dayDiscussionSeconds,
        voteSeconds: snapshot.voteSeconds,
      },
    } : {}),
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

function canPreserveRepeatPreset(setup: CreateRoomOptions, roles: RoleDistribution) {
  if (!setup.rolePreset || setup.rolePreset === "manual") return false;
  try {
    const preset = createGameConfigFromOptions(setup);
    // Share the form's preset policy without loading its editor into the playroom.
    // Accepted compositions that its preset would change reopen as a manual setup.
    if (preset.loversEnabled && !loversAvailableFor(preset.mode, preset.playerCount, preset.rolePreset)) return false;
    const expected = createRoomOptionsFromConfig(createGameConfigFromOptions({ ...setup, roles }));
    const repeated = createRoomOptionsFromConfig({ ...preset, rolePreset: "manual" });
    return JSON.stringify(repeated) === JSON.stringify(expected);
  } catch {
    return false;
  }
}

export function canOpenRecordedReplay(snapshot: GameSnapshot, currentUserId: string) {
  if (snapshot.phase !== "game_over") return false;
  if (snapshot.nextRoomOptions?.roomVisibility === "public") return true;
  const viewer = currentUserId ? snapshot.players.find((player) => player.userId === currentUserId) : undefined;
  return viewer?.playing === true || viewer?.host === true;
}

export function historyHrefForGame(gameId: string | null, eligible = false) {
  return gameId && eligible ? `/history/${encodeURIComponent(gameId)}/replay` : "/history";
}
