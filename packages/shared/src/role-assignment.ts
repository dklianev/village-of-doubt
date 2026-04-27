import type { RoleCode } from "./roles.js";
import { type RoleDistribution, countRoles } from "./game-config.js";

export interface AssignedRole {
  playerId: string;
  role: RoleCode;
}

export type RandomSource = () => number;

export function expandRoleDistribution(distribution: RoleDistribution): RoleCode[] {
  const roles: RoleCode[] = [];

  for (const [role, count] of Object.entries(distribution) as [RoleCode, number | undefined][]) {
    for (let index = 0; index < (count ?? 0); index += 1) {
      roles.push(role);
    }
  }

  return roles;
}

export function shuffle<T>(items: T[], random: RandomSource = Math.random): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = copy[index];
    const replacement = copy[swapIndex];
    if (current === undefined || replacement === undefined) {
      continue;
    }
    copy[index] = replacement;
    copy[swapIndex] = current;
  }
  return copy;
}

export function assignRoles(
  playerIds: string[],
  distribution: RoleDistribution,
  random: RandomSource = Math.random,
): AssignedRole[] {
  const roleCount = countRoles(distribution);
  if (roleCount !== playerIds.length) {
    throw new Error(`Броят роли (${roleCount}) не съвпада с броя играчи (${playerIds.length}).`);
  }

  const roles = shuffle(expandRoleDistribution(distribution), random);
  return playerIds.map((playerId, index) => {
    const role = roles[index];
    if (!role) {
      throw new Error("Липсва роля след разбъркване.");
    }
    return { playerId, role };
  });
}
