import { getRoleTeam, type NightActionCommand, type RoleCode, type TeamCode } from "@werewolf/shared";

export interface PrivatePlayerForNight {
  userId: string;
  role: RoleCode;
  alive: boolean;
  priestBlessed?: boolean;
}

export interface SubmittedNightAction {
  actorUserId: string;
  action: NightActionCommand;
}

export interface NightResolution {
  deaths: Array<{ userId: string; causeBg: string }>;
  checks: Array<{ actorUserId: string; targetUserId: string; role?: RoleCode; isEvil?: boolean; isCommissioner?: boolean }>;
  consumedPriestBlessings: string[];
}

export function resolveNight(
  players: PrivatePlayerForNight[],
  actions: SubmittedNightAction[],
): NightResolution {
  const aliveById = new Map(players.filter((player) => player.alive).map((player) => [player.userId, player]));
  const deaths = new Map<string, string>();
  const checks: NightResolution["checks"] = [];
  const factionKillVotes = new Map<TeamCode, Map<string, number>>();
  const healerProtectedTargets = new Set<string>();
  const witchHealedTargets = new Set<string>();
  const witchPoisonedTargets = new Set<string>();

  for (const submission of actions) {
    const actor = aliveById.get(submission.actorUserId);
    if (!actor) {
      continue;
    }

    const action = submission.action;

    if (action.kind === "faction_kill" && aliveById.has(action.targetUserId)) {
      const team = getRoleTeam(actor.role);
      const votes = factionKillVotes.get(team) ?? new Map<string, number>();
      votes.set(action.targetUserId, (votes.get(action.targetUserId) ?? 0) + 1);
      factionKillVotes.set(team, votes);
    }

    if (action.kind === "check_alignment" && aliveById.has(action.targetUserId)) {
      const target = aliveById.get(action.targetUserId);
      if (!target) {
        continue;
      }
      checks.push({
        actorUserId: submission.actorUserId,
        targetUserId: action.targetUserId,
        isEvil:
          getRoleTeam(target.role) === "mafia" ||
          getRoleTeam(target.role) === "werewolves" ||
          getRoleTeam(target.role) === "vampires",
      });
    }

    if (action.kind === "check_role" && aliveById.has(action.targetUserId)) {
      const target = aliveById.get(action.targetUserId);
      if (!target) {
        continue;
      }
      checks.push({
        actorUserId: submission.actorUserId,
        targetUserId: action.targetUserId,
        role: getRoleSeenBySeer(target.role),
      });
    }

    if (action.kind === "check_commissioner" && aliveById.has(action.targetUserId)) {
      const target = aliveById.get(action.targetUserId);
      if (!target) {
        continue;
      }
      checks.push({
        actorUserId: submission.actorUserId,
        targetUserId: action.targetUserId,
        isCommissioner: target.role === "commissioner",
      });
    }

    if (action.kind === "healer_protect" && aliveById.has(action.targetUserId)) {
      healerProtectedTargets.add(action.targetUserId);
    }
  }

  for (const [team, votes] of factionKillVotes.entries()) {
    const factionTarget = resolveMostVotedTarget(votes);
    if (factionTarget) {
      deaths.set(factionTarget, factionKillCauseBg(team));
    }
  }

  for (const submission of actions) {
    const actor = aliveById.get(submission.actorUserId);
    if (!actor) {
      continue;
    }

    const action = submission.action;
    if (action.kind === "witch_heal") {
      witchHealedTargets.add(action.targetUserId);
    }

    if (action.kind === "witch_poison" && aliveById.has(action.targetUserId)) {
      witchPoisonedTargets.add(action.targetUserId);
    }
  }

  for (const targetUserId of witchPoisonedTargets) {
    deaths.set(targetUserId, "Отровен от Вещицата.");
  }

  for (const targetUserId of witchHealedTargets) {
    deaths.delete(targetUserId);
  }

  for (const targetUserId of healerProtectedTargets) {
    deaths.delete(targetUserId);
  }

  const consumedPriestBlessings: string[] = [];
  for (const player of aliveById.values()) {
    if (player.priestBlessed && deaths.has(player.userId)) {
      deaths.delete(player.userId);
      consumedPriestBlessings.push(player.userId);
    }
  }

  return {
    deaths: [...deaths.entries()].map(([userId, causeBg]) => ({ userId, causeBg })),
    checks,
    consumedPriestBlessings,
  };
}

function resolveMostVotedTarget(votes: Map<string, number>): string | null {
  const ranked = [...votes.entries()].sort((left, right) => right[1] - left[1]);
  const [targetUserId, topVotes] = ranked[0] ?? [];
  if (!targetUserId || !topVotes) {
    return null;
  }

  const tied = ranked.filter(([, count]) => count === topVotes);
  return tied.length === 1 ? targetUserId : null;
}

function factionKillCauseBg(team: TeamCode) {
  if (team === "werewolves") {
    return "Изяден от Върколаците.";
  }
  if (team === "vampires") {
    return "Изцеден от Вампирите.";
  }
  if (team === "mafia") {
    return "Убит от Мафията.";
  }
  return "Убит през нощта.";
}

function getRoleSeenBySeer(role: RoleCode): RoleCode {
  return role === "jester" ? "ordinary_villager" : role;
}
