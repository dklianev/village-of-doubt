import { getRoleTeam, type RoleCode } from "./roles.js";

export type WinnerTeam = "village" | "werewolves" | "vampires" | "mafia" | "maniac" | "lovers" | "draw";

export interface WinPlayerState {
  playerId: string;
  role: RoleCode;
  alive: boolean;
  loverId?: string | null;
  personalWin?: boolean;
}

export interface WinResult {
  winner: WinnerTeam | null;
  reasonBg: string | null;
  winnerPlayerIds: string[];
  personalWinnerPlayerIds: string[];
}

export function evaluateWinCondition(players: WinPlayerState[]): WinResult {
  const alive = players.filter((player) => player.alive);
  const personalWinnerPlayerIds = players.filter((player) => player.personalWin).map((player) => player.playerId);
  const result = (
    winner: WinnerTeam | null,
    reasonBg: string | null,
    winnerPlayerIds: string[] = [],
  ): WinResult => ({ winner, reasonBg, winnerPlayerIds, personalWinnerPlayerIds });
  const winnersForTeam = (team: ReturnType<typeof getWinTeam>) =>
    players
      .filter((player) => getWinTeam(player.role) === team)
      .map((player) => player.playerId);

  if (alive.length === 0) {
    return result("draw", "Никой не остана жив.");
  }

  if (
    alive.length === 2 &&
    alive[0]?.loverId &&
    alive[0].loverId === alive[1]?.playerId &&
    alive[1].loverId === alive[0]?.playerId
  ) {
    const teams = new Set(alive.map((player) => getWinTeam(player.role)));
    if (teams.size > 1) {
      return result(
        "lovers",
        "Влюбените останаха единствените живи.",
        alive.map((player) => player.playerId),
      );
    }
  }

  const aliveWerewolves = alive.filter((player) => getWinTeam(player.role) === "werewolves").length;
  const aliveVampires = alive.filter((player) => getWinTeam(player.role) === "vampires").length;
  const aliveMafia = alive.filter((player) => getWinTeam(player.role) === "mafia").length;
  const aliveVillage = alive.filter((player) => getWinTeam(player.role) === "village").length;
  const aliveManiacs = alive.filter((player) => player.role === "maniac").length;
  const aliveEvil = aliveWerewolves + aliveVampires + aliveMafia;
  const totalAlive = alive.length;

  const aliveLethalFactionCount = [
    aliveWerewolves,
    aliveVampires,
    aliveMafia,
    aliveManiacs,
  ].filter((count) => count > 0).length;
  if (aliveLethalFactionCount > 1) {
    return result(null, null);
  }

  if (aliveManiacs > 0 && aliveManiacs >= totalAlive - aliveManiacs) {
    return result(
      "maniac",
      "Маниакът остана единствената заплаха на масата.",
      players.filter((player) => player.role === "maniac").map((player) => player.playerId),
    );
  }

  if (aliveManiacs > 0 && aliveEvil === 0) {
    return result(null, null);
  }

  if (aliveEvil === 0) {
    if (aliveVillage > 0) {
      return result(
        "village",
        "Всички вражески роли са извън играта.",
        winnersForTeam("village"),
      );
    }
    return result("draw", "На масата не остана отбор, който може да спечели.");
  }

  if (
    alive.length === 2 &&
    alive.some((player) => player.role === "cook") &&
    alive.some((player) => getWinTeam(player.role) === "werewolves" || getWinTeam(player.role) === "vampires")
  ) {
    return result(null, null);
  }

  if (aliveWerewolves > 0 && aliveVampires === 0 && aliveMafia === 0) {
    if (aliveWerewolves >= totalAlive - aliveWerewolves) {
      return result(
        "werewolves",
        "Върколаците вече контролират гласуването.",
        winnersForTeam("werewolves"),
      );
    }
    return result(null, null);
  }

  if (aliveVampires > 0 && aliveWerewolves === 0 && aliveMafia === 0) {
    if (aliveVampires >= totalAlive - aliveVampires) {
      return result(
        "vampires",
        "Вампирите вече контролират гласуването.",
        winnersForTeam("vampires"),
      );
    }
    return result(null, null);
  }

  if (aliveMafia > 0) {
    if (aliveMafia >= totalAlive - aliveMafia) {
      return result(
        "mafia",
        "Мафията вече контролира гласуването.",
        winnersForTeam("mafia"),
      );
    }
    return result(null, null);
  }

  return result(null, null);
}

function getWinTeam(role: RoleCode) {
  return role === "drunk" ? "village" as const : getRoleTeam(role);
}
