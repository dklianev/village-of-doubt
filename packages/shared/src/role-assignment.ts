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

/**
 * Default crypto-grade source. On Node 19+/modern browsers `globalThis.crypto.getRandomValues`
 * is available. Deterministic tests can still inject `() => 0.42`.
 */
export const defaultRandomSource: RandomSource = () => {
  const cryptoSource = (globalThis as { crypto?: { getRandomValues?: (array: Uint32Array) => void } }).crypto;
  if (cryptoSource?.getRandomValues) {
    const buffer = new Uint32Array(1);
    cryptoSource.getRandomValues(buffer);
    return (buffer[0] ?? 0) / 0x1_00_00_00_00;
  }
  throw new Error("Не е намерен криптографски източник на случайност. Раздаването на роли е спряно.");
};

export function shuffle<T>(items: T[], random: RandomSource = defaultRandomSource): T[] {
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
  random: RandomSource = defaultRandomSource,
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
