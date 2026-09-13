import type { GameConfig } from "./game-config.js";
import type { CreateRoomOptions } from "./protocol.js";
import { ROLE_DEFINITIONS, type RoleCode } from "./roles.js";

/** Public setup only: never spread room/join options or private runtime state here. */
export function createRoomOptionsFromConfig(config: GameConfig): CreateRoomOptions {
  return {
    mode: config.mode,
    roomName: config.roomName,
    playerCount: config.playerCount,
    maxPlayers: config.maxPlayers,
    roomVisibility: config.roomVisibility,
    rolePreset: config.rolePreset,
    roles: Object.fromEntries((Object.keys(ROLE_DEFINITIONS) as RoleCode[]).flatMap((code) => (
      config.roles[code] === undefined ? [] : [[code, config.roles[code]]]
    ))),
    narratorMode: config.narratorMode,
    communicationMode: config.communicationMode,
    tempoProfile: config.tempoProfile,
    customTimers: {
      roleRevealSeconds: config.timers.roleRevealSeconds,
      personalNightActionSeconds: config.timers.personalNightActionSeconds,
      factionNightActionSeconds: config.timers.factionNightActionSeconds,
      dayDiscussionSeconds: config.timers.dayDiscussionSeconds,
      playerSpeechSeconds: config.timers.playerSpeechSeconds,
      voteSeconds: config.timers.voteSeconds,
      resolutionSeconds: config.timers.resolutionSeconds,
      minimumPhaseSeconds: config.timers.minimumPhaseSeconds,
      autoAdvanceWhenReady: config.timers.autoAdvanceWhenReady,
    },
    loversEnabled: config.loversEnabled,
    revealRolesOnDeath: config.revealRolesOnDeath,
    tieBreaker: config.tieBreaker,
    firstNightKill: config.firstNightKill,
    allowSkipVote: config.allowSkipVote,
    majorityMode: config.majorityMode,
    autoStart: config.autoStart,
    beginnerMode: config.beginnerMode,
    advancedMode: config.advancedMode,
    werewolfVariant: config.werewolfVariant,
    mayorMode: config.mayorMode,
    promoRolesEnabled: config.promoRolesEnabled,
    mafiaNightKill: config.mafiaNightKill,
    doctorCanSelfProtect: config.doctorCanSelfProtect,
    commissionerResultMode: config.commissionerResultMode,
    maniacEnabled: config.maniacEnabled,
    jesterEnabled: config.jesterEnabled,
    narratorVoice: config.narratorVoice,
  };
}
