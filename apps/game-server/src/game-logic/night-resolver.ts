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

interface DeathIntent {
  causeBg: string;
  sourceTeam?: TeamCode;
  sourceRole?: RoleCode;
}

type DeathIntentsByTarget = Map<string, DeathIntent[]>;

export interface NightResolution {
  deaths: Array<{ userId: string; causeBg: string }>;
  delayedDeaths: Array<{ userId: string; causeBg: string }>;
  deathSources: Array<{ userId: string; sourceTeam?: TeamCode; sourceRole?: RoleCode }>;
  delayedDeathSources: Array<{ userId: string; sourceTeam?: TeamCode; sourceRole?: RoleCode }>;
  checks: Array<{
    actorUserId: string;
    targetUserId: string;
    targetUserIds?: string[];
    role?: RoleCode;
    isEvil?: boolean;
    isCommissioner?: boolean;
    coveredByLawyer?: boolean;
    messageBg?: string;
  }>;
  preventedDeaths: Array<{ userId: string; reasonBg: string; public?: boolean }>;
  protectedByPriest: string[];
  privateMessages: Array<{ targetUserId: string; messageBg: string }>;
}

export function getRoleblockedActorIds(
  players: PrivatePlayerForNight[],
  actions: SubmittedNightAction[],
): Set<string> {
  const aliveById = new Map(players.filter((player) => player.alive).map((player) => [player.userId, player]));
  const blockedActorIds = new Set<string>();
  for (const submission of actions) {
    const actor = aliveById.get(submission.actorUserId);
    if (actor?.role === "roleblocker" && submission.action.kind === "roleblock" && aliveById.has(submission.action.targetUserId)) {
      blockedActorIds.add(submission.action.targetUserId);
    }
  }
  return blockedActorIds;
}

export function resolveNight(
  players: PrivatePlayerForNight[],
  actions: SubmittedNightAction[],
): NightResolution {
  const aliveById = new Map(players.filter((player) => player.alive).map((player) => [player.userId, player]));
  const livingPlayers = players.filter((player) => player.alive);
  const deaths: DeathIntentsByTarget = new Map();
  const delayedDeaths: DeathIntentsByTarget = new Map();
  const checks: NightResolution["checks"] = [];
  const preventedDeaths: NightResolution["preventedDeaths"] = [];
  const privateMessages: NightResolution["privateMessages"] = [];
  const factionKillVotes = new Map<TeamCode, Map<string, number>>();
  const healerProtectedTargets = new Set<string>();
  const doctorProtectedTargets = new Set<string>();
  const bodyguardProtectedTargets = new Map<string, string>();
  const witchHealedTargets = new Set<string>();
  const witchPoisonedTargets = new Set<string>();
  const blockedActorIds = getRoleblockedActorIds(players, actions);
  const lawyerCoveredTargets = new Set<string>();

  for (const submission of actions) {
    const actor = aliveById.get(submission.actorUserId);
    if (actor?.role === "roleblocker" && submission.action.kind === "roleblock" && aliveById.has(submission.action.targetUserId)) {
      privateMessages.push({
        targetUserId: submission.action.targetUserId,
        messageBg: "Блокиращият спря нощното ти действие.",
      });
      privateMessages.push({
        targetUserId: submission.actorUserId,
        messageBg: "Избраният играч беше блокиран за тази нощ.",
      });
    }
  }

  for (const submission of actions) {
    const actor = aliveById.get(submission.actorUserId);
    if (
      actor?.role === "lawyer" &&
      !blockedActorIds.has(submission.actorUserId) &&
      submission.action.kind === "lawyer_cover" &&
      aliveById.has(submission.action.targetUserId)
    ) {
      lawyerCoveredTargets.add(submission.action.targetUserId);
      privateMessages.push({
        targetUserId: submission.actorUserId,
        messageBg: "Адвокатът подготви чисто алиби за избрания играч.",
      });
    }
  }

  for (const submission of actions) {
    const actor = aliveById.get(submission.actorUserId);
    if (!actor) {
      continue;
    }
    const action = submission.action;
    if (blockedActorIds.has(submission.actorUserId) && action.kind !== "roleblock" && action.kind !== "skip") {
      continue;
    }

    if (action.kind === "faction_kill" && aliveById.has(action.targetUserId)) {
      const target = aliveById.get(action.targetUserId);
      if (!target || target.userId === actor.userId) {
        continue;
      }
      const team = getRoleTeam(actor.role);
      if (actor.role === "vampire_hunter") {
        if (target.role === "vampire_hunter") {
          continue;
        }
        addDeathIntent(deaths, action.targetUserId, {
          causeBg: "Падна от удара на Убиеца на вампири.",
          sourceRole: actor.role,
        });
        continue;
      }
      if (actor.role === "vigilante" || actor.role === "maniac") {
        addDeathIntent(deaths, action.targetUserId, {
          causeBg: actor.role === "maniac" ? "Падна от изстрела на Маниака." : "Падна от изстрела на Вигиланте.",
          sourceRole: actor.role,
        });
        continue;
      }
      if (isFactionTeam(team) && getRoleTeam(target.role) === team) {
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
        isEvil: lawyerCoveredTargets.has(action.targetUserId) ? false : isEvilTeam(getRoleTeam(target.role)),
        ...(lawyerCoveredTargets.has(action.targetUserId)
          ? { coveredByLawyer: true, messageBg: "Проверката изглежда чиста." }
          : {}),
      });
    }

    if (action.kind === "check_role" && aliveById.has(action.targetUserId)) {
      const target = aliveById.get(action.targetUserId);
      if (!target) {
        continue;
      }
      const covered = lawyerCoveredTargets.has(action.targetUserId);
      if (actor.role === "seer" || actor.role === "oracle") {
        const isThreat = covered ? false : isNightThreat(target.role);
        checks.push({
          actorUserId: submission.actorUserId,
          targetUserId: action.targetUserId,
          isEvil: isThreat,
          ...(covered ? { coveredByLawyer: true } : {}),
          messageBg: isThreat
            ? "Видението потвърди нощна заплаха."
            : "Видението не откри Върколак или Вампир.",
        });
        continue;
      }
      checks.push({
        actorUserId: submission.actorUserId,
        targetUserId: action.targetUserId,
        role: covered ? "civilian" : getRoleSeenBySeer(target.role),
        ...(covered
          ? { coveredByLawyer: true, messageBg: "Адвокатското алиби скри досието. Избраният играч изглежда като Гражданин." }
          : {}),
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
        isCommissioner: lawyerCoveredTargets.has(action.targetUserId) ? false : target.role === "commissioner",
        ...(lawyerCoveredTargets.has(action.targetUserId)
          ? { coveredByLawyer: true, messageBg: "Адвокатско алиби скри следата." }
          : {}),
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
      if (actor.role === "bodyguard") {
        bodyguardProtectedTargets.set(action.targetUserId, submission.actorUserId);
      } else if (actor.role === "doctor") {
        doctorProtectedTargets.add(action.targetUserId);
      } else {
        healerProtectedTargets.add(action.targetUserId);
      }
    }

    if (action.kind === "blacksmith_sword" && aliveById.has(action.receiverUserId) && aliveById.has(action.targetUserId)) {
      addDeathIntent(deaths, action.targetUserId, {
        causeBg: "Падна от ковашкия меч.",
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
        addDeathIntent(deaths, submission.actorUserId, {
          causeBg: "Падна, след като посети чудовище.",
          sourceRole: actor.role,
        });
        addDeathIntent(deaths, action.targetUserId, {
          causeBg: "Падна след разкритието на Уличната котка.",
          sourceRole: actor.role,
        });
        privateMessages.push({
          targetUserId: submission.actorUserId,
          messageBg: "Избра чудовище. И двамата напускате играта.",
        });
      } else {
        privateMessages.push({
          targetUserId: submission.actorUserId,
          messageBg: "Изборът ти беше безопасен тази нощ.",
        });
      }
    }
  }

  for (const [team, votes] of factionKillVotes.entries()) {
    const livingFactionCount = livingPlayers.filter(
      (player) => player.alive && getRoleTeam(player.role) === team && !blockedActorIds.has(player.userId),
    ).length;
    const factionTarget = resolveConsensusTarget(votes, livingFactionCount);
    if (factionTarget) {
      if (team === "vampires") {
        addDeathIntent(delayedDeaths, factionTarget, {
          causeBg: "Падна от вампирското ухапване.",
          sourceTeam: team,
        });
      } else {
        addDeathIntent(deaths, factionTarget, {
          causeBg: factionKillCauseBg(team),
          sourceTeam: team,
        });
      }
    }
  }

  for (const submission of actions) {
    const actor = aliveById.get(submission.actorUserId);
    if (!actor || blockedActorIds.has(submission.actorUserId)) {
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
    addDeathIntent(deaths, targetUserId, {
      causeBg: "Падна от отровата на Вещицата.",
      sourceRole: "witch",
    });
  }

  for (const targetUserId of witchHealedTargets) {
    preventDeathFromFaction(deaths, targetUserId, "Лечебната отвара спря нощна атака.", preventedDeaths);
    preventDeathFromFaction(delayedDeaths, targetUserId, "Лечебната отвара спря нощна атака.", preventedDeaths);
  }

  for (const targetUserId of healerProtectedTargets) {
    preventDeath(deaths, targetUserId, "Лечителят спря нощна атака.", preventedDeaths);
    preventDeath(delayedDeaths, targetUserId, "Лечителят спря нощна атака.", preventedDeaths);
  }

  for (const targetUserId of doctorProtectedTargets) {
    preventDeath(deaths, targetUserId, "Докторът спря нощна смърт.", preventedDeaths);
    preventDeath(delayedDeaths, targetUserId, "Докторът спря нощна смърт.", preventedDeaths);
  }

  applyBodyguardProtection(deaths, bodyguardProtectedTargets, "Бодигардът пое нощната атака.", preventedDeaths);
  applyBodyguardProtection(delayedDeaths, bodyguardProtectedTargets, "Бодигардът пое вампирското ухапване.", preventedDeaths);

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
    deaths: resolveDeathIntents(deaths),
    delayedDeaths: resolveDeathIntents(delayedDeaths),
    deathSources: resolveDeathSources(deaths),
    delayedDeathSources: resolveDeathSources(delayedDeaths),
    checks,
    preventedDeaths,
    protectedByPriest: [...new Set(protectedByPriest)],
    privateMessages,
  };
}

function resolveConsensusTarget(votes: Map<string, number>, livingFactionCount: number): string | null {
  const ranked = [...votes.entries()].sort((left, right) => right[1] - left[1]);
  const [targetUserId, topVotes] = ranked[0] ?? [];
  if (!targetUserId || !topVotes) {
    return null;
  }

  const tied = ranked.filter(([, count]) => count === topVotes);
  return tied.length === 1 && topVotes === livingFactionCount ? targetUserId : null;
}

function factionKillCauseBg(team: TeamCode) {
  if (team === "werewolves") {
    return "Падна от атаката на Върколаците.";
  }
  if (team === "vampires") {
    return "Падна от атаката на Вампирите.";
  }
  if (team === "mafia") {
    return "Падна от атаката на Мафията.";
  }
  return "Не преживя нощта.";
}

function getRoleSeenBySeer(role: RoleCode): RoleCode {
  return role === "jester" ? "ordinary_villager" : role;
}

function isEvilTeam(team: TeamCode): boolean {
  return team === "mafia" || team === "werewolves" || team === "vampires";
}

function isFactionTeam(team: TeamCode): boolean {
  return team === "mafia" || team === "werewolves" || team === "vampires";
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
  deaths: DeathIntentsByTarget,
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

function preventDeathFromFaction(
  deaths: DeathIntentsByTarget,
  targetUserId: string,
  reasonBg: string,
  preventedDeaths: NightResolution["preventedDeaths"],
) {
  const prevented = removeDeathIntents(
    deaths,
    targetUserId,
    (death) => death.sourceTeam !== undefined && isFactionTeam(death.sourceTeam),
  );
  if (!prevented) {
    return;
  }
  preventedDeaths.push({ userId: targetUserId, reasonBg });
}

function applyBodyguardProtection(
  deaths: DeathIntentsByTarget,
  protectedTargets: Map<string, string>,
  reasonBg: string,
  preventedDeaths: NightResolution["preventedDeaths"],
) {
  for (const [targetUserId, bodyguardUserId] of protectedTargets.entries()) {
    if (!deaths.has(targetUserId) || targetUserId === bodyguardUserId) {
      continue;
    }
    deaths.delete(targetUserId);
    preventedDeaths.push({ userId: targetUserId, reasonBg });
    if (!deaths.has(bodyguardUserId)) {
      addDeathIntent(deaths, bodyguardUserId, {
        causeBg: "Загина, докато пазеше друг играч.",
        sourceRole: "bodyguard",
      });
    }
  }
}

function protectSpecialFactionTargets(
  deaths: DeathIntentsByTarget,
  aliveById: Map<string, PrivatePlayerForNight>,
  preventedDeaths: NightResolution["preventedDeaths"],
  alreadyDyingUserIds = new Set<string>(),
) {
  const hunterAlive = [...aliveById.values()].some(
    (player) => player.role === "hunter" && player.alive && !deaths.has(player.userId) && !alreadyDyingUserIds.has(player.userId),
  );
  for (const [userId, deathIntents] of [...deaths.entries()]) {
    if (!deathIntents.some((death) => death.sourceTeam === "werewolves" || death.sourceTeam === "vampires")) {
      continue;
    }
    const target = aliveById.get(userId);
    if (!target) {
      continue;
    }
    if (target.role === "cook") {
      removeDeathIntents(
        deaths,
        userId,
        (death) => death.sourceTeam === "werewolves" || death.sourceTeam === "vampires",
      );
      preventedDeaths.push({
        userId,
        reasonBg: "Готвачът оцеля след нощната атака.",
        public: false,
      });
    }
    if (target.role === "red_riding_hood" && hunterAlive) {
      removeDeathIntents(
        deaths,
        userId,
        (death) => death.sourceTeam === "werewolves" || death.sourceTeam === "vampires",
      );
      preventedDeaths.push({ userId, reasonBg: "Ловецът още пази Червената шапчица." });
    }
  }
}

function addDeathIntent(deaths: DeathIntentsByTarget, targetUserId: string, death: DeathIntent) {
  const intents = deaths.get(targetUserId) ?? [];
  intents.push(death);
  deaths.set(targetUserId, intents);
}

function removeDeathIntents(
  deaths: DeathIntentsByTarget,
  targetUserId: string,
  shouldRemove: (death: DeathIntent) => boolean,
) {
  const intents = deaths.get(targetUserId);
  if (!intents) {
    return false;
  }

  const remaining = intents.filter((death) => !shouldRemove(death));
  if (remaining.length === intents.length) {
    return false;
  }
  if (remaining.length === 0) {
    deaths.delete(targetUserId);
  } else {
    deaths.set(targetUserId, remaining);
  }
  return true;
}

function resolveDeathIntents(deaths: DeathIntentsByTarget) {
  return [...deaths.entries()].flatMap(([userId, intents]) => {
    const causes = [...new Set(intents.map((death) => death.causeBg))].sort();
    return causes.length > 0 ? [{ userId, causeBg: causes.join(" ") }] : [];
  });
}

function resolveDeathSources(deaths: DeathIntentsByTarget): NightResolution["deathSources"] {
  return [...deaths.entries()].flatMap(([userId, intents]) =>
    intents.map((intent) => ({
      userId,
      ...(intent.sourceTeam ? { sourceTeam: intent.sourceTeam } : {}),
      ...(intent.sourceRole ? { sourceRole: intent.sourceRole } : {}),
    })),
  );
}
