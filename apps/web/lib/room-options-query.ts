import type { CreateRoomOptions, RoleCode, RoleDistribution } from "@werewolf/shared";

export function roomOptionsToQuery(options: CreateRoomOptions) {
  const params = new URLSearchParams();

  if (options.mode) params.set("mode", options.mode);
  if (options.playerCount) params.set("players", String(options.playerCount));
  if (options.maxPlayers) params.set("maxPlayers", String(options.maxPlayers));
  if (options.roomName) params.set("roomName", options.roomName);
  if (options.roomVisibility) params.set("visibility", options.roomVisibility);
  if (options.rolePreset) params.set("preset", options.rolePreset);
  if (options.communicationMode) params.set("communication", options.communicationMode);
  if (options.narratorMode) params.set("narrator", options.narratorMode);
  if (options.tempoProfile) params.set("tempo", options.tempoProfile);
  if (options.tempoProfile === "manual" && options.customTimers) {
    if (typeof options.customTimers.dayDiscussionSeconds === "number") {
      params.set("tempoDay", String(options.customTimers.dayDiscussionSeconds));
    }
    if (typeof options.customTimers.factionNightActionSeconds === "number") {
      params.set("tempoNight", String(options.customTimers.factionNightActionSeconds));
    }
    if (typeof options.customTimers.voteSeconds === "number") {
      params.set("tempoVote", String(options.customTimers.voteSeconds));
    }
    if (typeof options.customTimers.autoAdvanceWhenReady === "boolean") {
      params.set("tempoReady", options.customTimers.autoAdvanceWhenReady ? "1" : "0");
    }
  }
  if (options.loversEnabled) params.set("lovers", "1");
  if (typeof options.revealRolesOnDeath === "boolean") {
    params.set("reveal", options.revealRolesOnDeath ? "1" : "0");
  }
  if (typeof options.allowSkipVote === "boolean") {
    params.set("skip", options.allowSkipVote ? "1" : "0");
  }
  if (options.majorityMode) params.set("majority", options.majorityMode);
  if (options.autoStart) params.set("autoStart", "1");
  if (options.beginnerMode) params.set("beginner", "1");
  if (options.advancedMode) params.set("advanced", "1");
  if (options.werewolfVariant) params.set("variant", options.werewolfVariant);
  if (options.mayorMode) params.set("mayorMode", options.mayorMode);
  if (options.promoRolesEnabled) params.set("promo", "1");
  if (typeof options.mafiaNightKill === "boolean") {
    params.set("mafiaKill", options.mafiaNightKill ? "1" : "0");
  }
  if (options.doctorCanSelfProtect) params.set("doctorSelf", "1");
  if (options.commissionerResultMode) params.set("commissionerResult", options.commissionerResultMode);
  if (options.maniacEnabled) params.set("maniac", "1");
  if (options.jesterEnabled) params.set("jester", "1");
  if (options.narratorVoice) params.set("narratorVoice", options.narratorVoice);
  if (options.spectator) params.set("spectator", "1");
  if (options.roles) params.set("roles", stringifyRolesParam(options.roles));

  const query = params.toString();
  return query ? `?${query}` : "";
}

export function stringifyRolesParam(roles: RoleDistribution) {
  return Object.entries(roles)
    .filter((entry): entry is [RoleCode, number] => typeof entry[1] === "number" && entry[1] > 0)
    .map(([role, count]) => `${role}:${Math.floor(count)}`)
    .join(",");
}
