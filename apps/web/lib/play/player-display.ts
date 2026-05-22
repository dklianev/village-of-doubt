import { ROLE_DEFINITIONS, type RoleCode } from "@werewolf/shared";
import type { PublicPlayer } from "@/lib/play/types";

export function roleSigil(role: RoleCode) {
  const sigils: Partial<Record<RoleCode, string>> = {
    civilian: "Г",
    commissioner: "К",
    mafioso: "М",
    don: "Д",
    ordinary_villager: "С",
    werewolf: "В",
    seer: "Я",
    witch: "В",
    healer: "Л",
    priest: "С",
    hunter: "Л",
    cupid: "К",
    vampire: "В",
    jester: "Ш",
    little_girl: "М",
    thief: "К",
  };

  return sigils[role] ?? ROLE_DEFINITIONS[role].nameBg.slice(0, 1);
}

export function playerStatusBadge(player: PublicPlayer, phase: string): string {
  if (player.host) {
    return "водещ";
  }
  if (player.narrator) {
    return "разказвач";
  }
  if (phase === "lobby") {
    return player.ready ? "готов" : "чака";
  }
  if (!player.playing) {
    return "извън играта";
  }
  if (!player.alive) {
    return "елиминиран";
  }
  if (phase === "voting") {
    return player.hasVoted ? "гласувал" : "обмисля";
  }
  if (phase === "first_night" || phase === "night") {
    return player.actedThisPhase ? "действал" : "буден";
  }
  if (phase === "day_discussion") {
    return "говори";
  }
  if (phase === "day_announcement") {
    return "слуша";
  }
  if (phase === "resolution") {
    return "развръзка";
  }
  if (phase === "hunter_revenge") {
    return "ловецът стреля";
  }
  if (phase === "mayor_successor") {
    return "избор на кмет";
  }
  if (phase === "paused") {
    return "пауза";
  }
  if (phase === "game_over") {
    return "край";
  }
  return "играе";
}

export function playerInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function playerTokenClass(player: PublicPlayer) {
  return [
    "player-token rounded-2xl px-4 py-3",
    player.ready ? "is-ready" : "",
    !player.connected ? "is-offline" : "",
    player.playing && !player.alive ? "is-dead" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function arePlayersEqual(a: PublicPlayer, b: PublicPlayer) {
  return a.userId === b.userId
    && a.displayName === b.displayName
    && a.connected === b.connected
    && a.ready === b.ready
    && a.playing === b.playing
    && a.alive === b.alive
    && a.host === b.host
    && a.narrator === b.narrator
    && a.acceptedFullNarrator === b.acceptedFullNarrator
    && a.mayor === b.mayor
    && a.hasVoted === b.hasVoted
    && a.actedThisPhase === b.actedThisPhase
    && a.revealedRole === b.revealedRole;
}
