import { getRoleTeam, type RoleCode } from "./roles.js";

export type WinnerTeam = "village" | "werewolves" | "vampires" | "mafia" | "maniac" | "lovers" | "draw";

export interface WinPlayerState {
  playerId: string;
  role: RoleCode;
  alive: boolean;
  loverId?: string | null;
}

export interface WinResult {
  winner: WinnerTeam | null;
  reasonBg: string | null;
}

export function evaluateWinCondition(players: WinPlayerState[]): WinResult {
  const alive = players.filter((player) => player.alive);

  if (alive.length === 0) {
    return { winner: "draw", reasonBg: "Няма останали живи играчи." };
  }

  if (
    alive.length === 2 &&
    alive[0]?.loverId &&
    alive[0].loverId === alive[1]?.playerId &&
    alive[1].loverId === alive[0]?.playerId
  ) {
    const teams = new Set(alive.map((player) => getRoleTeam(player.role)));
    if (teams.size > 1) {
      return { winner: "lovers", reasonBg: "Влюбените останаха последните двама живи." };
    }
  }

  const aliveWerewolves = alive.filter((player) => getRoleTeam(player.role) === "werewolves").length;
  const aliveVampires = alive.filter((player) => getRoleTeam(player.role) === "vampires").length;
  const aliveMafia = alive.filter((player) => getRoleTeam(player.role) === "mafia").length;
  const aliveVillage = alive.filter((player) => getRoleTeam(player.role) === "village").length;
  const aliveManiacs = alive.filter((player) => player.role === "maniac").length;
  const aliveEvil = aliveWerewolves + aliveVampires + aliveMafia;
  const totalAlive = alive.length;
  const aliveWerewolfOrVampire = aliveWerewolves + aliveVampires;

  if (aliveManiacs > 0 && aliveManiacs >= totalAlive - aliveManiacs) {
    return { winner: "maniac", reasonBg: "Маниакът остана последната реална заплаха в града." };
  }

  if (aliveManiacs > 0 && aliveEvil === 0) {
    return { winner: null, reasonBg: null };
  }

  if (aliveEvil === 0) {
    if (aliveVillage > 0) {
      return { winner: "village", reasonBg: "Всички представители на злата страна са елиминирани." };
    }
    return { winner: "draw", reasonBg: "Останаха само неутрални роли без отборна победа." };
  }

  // Cook stalemate clause — preserved as-is.
  // When exactly one nightly threat (WW or Vampire) faces exactly one villager,
  // and that villager is the Cook, the night threat cannot kill them.
  if (
    aliveWerewolfOrVampire === 1 &&
    aliveMafia === 0 &&
    aliveVillage === 1 &&
    alive.some((player) => player.alive && player.role === "cook")
  ) {
    return { winner: "draw", reasonBg: "Последната нощна заплаха не може да преодолее Готвача." };
  }

  // Mixed nightly threats (Werewolves + Vampires together against village).
  // Rare scenario; resolve at parity with tie-break by faction headcount.
  if (aliveWerewolves > 0 && aliveVampires > 0 && aliveMafia === 0) {
    if (aliveWerewolfOrVampire >= totalAlive - aliveWerewolfOrVampire) {
      if (aliveWerewolves > aliveVampires) {
        return { winner: "werewolves", reasonBg: "Върколаците надделяха в смесената нощ." };
      }
      if (aliveVampires > aliveWerewolves) {
        return { winner: "vampires", reasonBg: "Вампирите надделяха в смесената нощ." };
      }
      return { winner: "draw", reasonBg: "Върколаци и вампири се изравниха над селото." };
    }
    return { winner: null, reasonBg: null };
  }

  // Werewolves alone — parity rule per docs/rules-bg.md:667.
  if (aliveWerewolves > 0 && aliveVampires === 0 && aliveMafia === 0) {
    if (aliveWerewolves >= totalAlive - aliveWerewolves) {
      return { winner: "werewolves", reasonBg: "Върколаците са равни или повече от живите селяни." };
    }
    return { winner: null, reasonBg: null };
  }

  // Vampires alone — same parity rule as werewolves.
  if (aliveVampires > 0 && aliveWerewolves === 0 && aliveMafia === 0) {
    if (aliveVampires >= totalAlive - aliveVampires) {
      return { winner: "vampires", reasonBg: "Вампирите са равни или повече от живите селяни." };
    }
    return { winner: null, reasonBg: null };
  }

  // Mafia clause — unchanged (already parity-based).
  if (aliveMafia > 0) {
    if (aliveMafia >= totalAlive - aliveMafia) {
      return { winner: "mafia", reasonBg: "Мафията е равна или повече от всички останали живи." };
    }
    return { winner: null, reasonBg: null };
  }

  return { winner: null, reasonBg: null };
}
