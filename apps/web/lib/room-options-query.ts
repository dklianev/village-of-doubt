import type { CreateRoomOptions, RoleCode, RoleDistribution } from "@werewolf/shared";

export const ROOM_TIMER_QUERY_KEYS = [
  { key: "dayDiscussionSeconds", query: "tempoDay" },
  { key: "factionNightActionSeconds", query: "tempoNight" },
  { key: "voteSeconds", query: "tempoVote" },
  { key: "roleRevealSeconds", query: "tempoReveal" },
  { key: "personalNightActionSeconds", query: "tempoPersonalNight" },
  { key: "playerSpeechSeconds", query: "tempoSpeech" },
  { key: "resolutionSeconds", query: "tempoResolution" },
  { key: "minimumPhaseSeconds", query: "tempoMinimum" },
] as const;

const BOOLEAN_QUERY_KEYS = [
  ["loversEnabled", "lovers"],
  ["revealRolesOnDeath", "reveal"],
  ["allowSkipVote", "skip"],
  ["firstNightKill", "firstNightKill"],
  ["autoStart", "autoStart"],
  ["beginnerMode", "beginner"],
  ["advancedMode", "advanced"],
  ["promoRolesEnabled", "promo"],
  ["mafiaNightKill", "mafiaKill"],
  ["doctorCanSelfProtect", "doctorSelf"],
  ["maniacEnabled", "maniac"],
  ["jesterEnabled", "jester"],
] as const;

const STRING_QUERY_KEYS = [
  ["mode", "mode"],
  ["roomName", "roomName"],
  ["roomVisibility", "visibility"],
  ["rolePreset", "preset"],
  ["communicationMode", "communication"],
  ["narratorMode", "narrator"],
  ["tempoProfile", "tempo"],
  ["majorityMode", "majority"],
  ["tieBreaker", "tieBreaker"],
  ["werewolfVariant", "variant"],
  ["mayorMode", "mayorMode"],
  ["commissionerResultMode", "commissionerResult"],
  ["narratorVoice", "narratorVoice"],
] as const;

export function roomOptionsToQuery(options: CreateRoomOptions) {
  const params = new URLSearchParams();

  for (const [key, query] of STRING_QUERY_KEYS) {
    if (options[key]) params.set(query, options[key]);
  }
  if (options.playerCount) params.set("players", String(options.playerCount));
  if (options.maxPlayers) params.set("maxPlayers", String(options.maxPlayers));
  if (options.tempoProfile === "manual" && options.customTimers) {
    for (const { key, query } of ROOM_TIMER_QUERY_KEYS) {
      if (typeof options.customTimers[key] === "number") {
        params.set(query, String(options.customTimers[key]));
      }
    }
    if (typeof options.customTimers.autoAdvanceWhenReady === "boolean") {
      params.set("tempoReady", options.customTimers.autoAdvanceWhenReady ? "1" : "0");
    }
  }
  for (const [key, query] of BOOLEAN_QUERY_KEYS) {
    if (typeof options[key] === "boolean") params.set(query, options[key] ? "1" : "0");
  }
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
