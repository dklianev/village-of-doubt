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
  delayedDeaths: Array<{ userId: string; causeBg: string }>;
  checks: Array<{
    actorUserId: string;
    targetUserId: string;
    targetUserIds?: string[];
    role?: RoleCode;
    isEvil?: boolean;
    isCommissioner?: boolean;
    messageBg?: string;
  }>;
  preventedDeaths: Array<{ userId: string; reasonBg: string }>;
  protectedByPriest: string[];
  privateMessages: Array<{ targetUserId: string; messageBg: string }>;
}

export function resolveNight(
  players: PrivatePlayerForNight[],
  actions: SubmittedNightAction[],
): NightResolution {
  const aliveById = new Map(players.filter((player) => player.alive).map((player) => [player.userId, player]));
  const livingPlayers = players.filter((player) => player.alive);
  const deaths = new Map<string, { causeBg: string; sourceTeam?: TeamCode; sourceRole?: RoleCode }>();
  const delayedDeaths = new Map<string, { causeBg: string; sourceTeam?: TeamCode }>();
  const checks: NightResolution["checks"] = [];
  const preventedDeaths: NightResolution["preventedDeaths"] = [];
  const privateMessages: NightResolution["privateMessages"] = [];
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
      if (actor.role === "vampire_hunter") {
        deaths.set(action.targetUserId, {
          causeBg: "Повален от Убиеца на вампири.",
          sourceRole: actor.role,
        });
        continue;
      }
      if (actor.role === "vigilante" || actor.role === "maniac") {
        deaths.set(action.targetUserId, {
          causeBg: actor.role === "maniac" ? "Убит от Маниака." : "Убит от Вигиланте.",
          sourceRole: actor.role,
        });
        continue;
      }
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

    if (action.kind === "investigator_check" && aliveById.has(action.targetUserId)) {
      const trio = getAdjacentLivingTrio(livingPlayers, action.targetUserId);
      checks.push({
        actorUserId: submission.actorUserId,
        targetUserId: action.targetUserId,
        targetUserIds: trio.map((player) => player.userId),
        isEvil: trio.some((player) => isNightThreat(player.role)),
        messageBg: trio.some((player) => isNightThreat(player.role))
          ? "Следата е гореща: в избраната тройка има Върколак или Вампир."
          : "Следата изстина: в избраната тройка няма Върколак или Вампир.",
      });
    }

    if (action.kind === "healer_protect" && aliveById.has(action.targetUserId)) {
      healerProtectedTargets.add(action.targetUserId);
    }

    if (action.kind === "blacksmith_sword" && aliveById.has(action.receiverUserId) && aliveById.has(action.targetUserId)) {
      deaths.set(action.targetUserId, {
        causeBg: "Повален от ковашкия меч.",
        sourceRole: actor.role,
      });
      privateMessages.push({
        targetUserId: action.receiverUserId,
        messageBg: "Ковачът ти даде меч и изборът ти беше изпълнен тази нощ.",
      });
    }

    if (action.kind === "stray_cat_choose" && aliveById.has(action.targetUserId)) {
      const target = aliveById.get(action.targetUserId);
      if (!target) {
        continue;
      }
      if (isNightThreat(target.role)) {
        deaths.set(submission.actorUserId, {
          causeBg: "Уличната котка попадна при чудовище.",
          sourceRole: actor.role,
        });
        deaths.set(action.targetUserId, {
          causeBg: "Разкрит от Уличната котка.",
          sourceRole: actor.role,
        });
        privateMessages.push({
          targetUserId: submission.actorUserId,
          messageBg: "Котката избра чудовище. И двамата падате от играта.",
        });
      } else {
        privateMessages.push({
          targetUserId: submission.actorUserId,
          messageBg: "Котката намери безопасен дом тази нощ.",
        });
      }
    }
  }

  for (const [team, votes] of factionKillVotes.entries()) {
    const factionTarget = resolveMostVotedTarget(votes);
    if (factionTarget) {
      if (team === "vampires") {
        delayedDeaths.set(factionTarget, {
          causeBg: "Умря от вампирско ухапване.",
          sourceTeam: team,
        });
      } else {
        deaths.set(factionTarget, {
          causeBg: factionKillCauseBg(team),
          sourceTeam: team,
        });
      }
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
    deaths.set(targetUserId, {
      causeBg: "Отровен от Вещицата.",
      sourceRole: "witch",
    });
  }

  for (const targetUserId of witchHealedTargets) {
    preventDeath(deaths, targetUserId, "Лечебната отвара спря нощна смърт.", preventedDeaths);
    preventDeath(delayedDeaths, targetUserId, "Лечебната отвара спря вампирско ухапване.", preventedDeaths);
  }

  for (const targetUserId of healerProtectedTargets) {
    preventDeath(deaths, targetUserId, "Лечителят спря нощна смърт.", preventedDeaths);
    preventDeath(delayedDeaths, targetUserId, "Лечителят спря вампирско ухапване.", preventedDeaths);
  }

  const protectedByPriest: string[] = [];
  for (const player of aliveById.values()) {
    if (player.priestBlessed && deaths.has(player.userId)) {
      deaths.delete(player.userId);
      protectedByPriest.push(player.userId);
    }
    if (player.priestBlessed && delayedDeaths.has(player.userId)) {
      delayedDeaths.delete(player.userId);
      protectedByPriest.push(player.userId);
    }
  }

  protectSpecialFactionTargets(deaths, aliveById, preventedDeaths);
  protectSpecialFactionTargets(delayedDeaths, aliveById, preventedDeaths, new Set(deaths.keys()));

  return {
    deaths: [...deaths.entries()].map(([userId, death]) => ({ userId, causeBg: death.causeBg })),
    delayedDeaths: [...delayedDeaths.entries()].map(([userId, death]) => ({ userId, causeBg: death.causeBg })),
    checks,
    preventedDeaths,
    protectedByPriest: [...new Set(protectedByPriest)],
    privateMessages,
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

function isNightThreat(role: RoleCode): boolean {
  const team = getRoleTeam(role);
  return team === "werewolves" || team === "vampires";
}

function getAdjacentLivingTrio(players: PrivatePlayerForNight[], centerUserId: string) {
  if (players.length <= 3) {
    return players;
  }
  const centerIndex = players.findIndex((player) => player.userId === centerUserId);
  if (centerIndex === -1) {
    return [];
  }
  const previous = players[(centerIndex - 1 + players.length) % players.length];
  const center = players[centerIndex];
  const next = players[(centerIndex + 1) % players.length];
  return [previous, center, next].filter((player): player is PrivatePlayerForNight => Boolean(player));
}

function preventDeath(
  deaths: Map<string, { causeBg: string; sourceTeam?: TeamCode; sourceRole?: RoleCode }>,
  targetUserId: string,
  reasonBg: string,
  preventedDeaths: NightResolution["preventedDeaths"],
) {
  if (!deaths.has(targetUserId)) {
    return;
  }
  deaths.delete(targetUserId);
  preventedDeaths.push({ userId: targetUserId, reasonBg });
}

function protectSpecialFactionTargets(
  deaths: Map<string, { causeBg: string; sourceTeam?: TeamCode; sourceRole?: RoleCode }>,
  aliveById: Map<string, PrivatePlayerForNight>,
  preventedDeaths: NightResolution["preventedDeaths"],
  alreadyDyingUserIds = new Set<string>(),
) {
  const hunterAlive = [...aliveById.values()].some(
    (player) => player.role === "hunter" && player.alive && !deaths.has(player.userId) && !alreadyDyingUserIds.has(player.userId),
  );
  for (const [userId, death] of [...deaths.entries()]) {
    if (death.sourceTeam !== "werewolves" && death.sourceTeam !== "vampires") {
      continue;
    }
    const target = aliveById.get(userId);
    if (!target) {
      continue;
    }
    if (target.role === "cook") {
      deaths.delete(userId);
      preventedDeaths.push({ userId, reasonBg: "Готвачът оцеля след нощната атака." });
    }
    if (target.role === "red_riding_hood" && hunterAlive) {
      deaths.delete(userId);
      preventedDeaths.push({ userId, reasonBg: "Ловецът още пази Червената шапчица." });
    }
  }
}
