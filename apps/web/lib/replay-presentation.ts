import { getRoleNameBg, phaseLabelBg, type GameMode, type GamePhase, type RoleCode } from "@werewolf/shared";
import { isUuid } from "./identifiers";

export type ReplayEvent = {
  id: string;
  round: number;
  phase: string;
  type: string;
  actorId: string | null;
  targetId: string | null;
  payload: unknown;
  createdAt: Date;
  visibility: string;
};
export type ReplayCursor = { createdAt: Date; id: string };

export function parseReplayCursor(value: string | undefined): ReplayCursor | undefined {
  if (!value || value.length > 100) return undefined;
  const [timestamp, id, extra] = value.split("~");
  if (!timestamp || !id || extra !== undefined || !isUuid(id)) return undefined;
  const createdAt = new Date(timestamp);
  return Number.isFinite(createdAt.getTime()) ? { createdAt, id } : undefined;
}

export function replayCursor(event: ReplayCursor) {
  return `${event.createdAt.toISOString()}~${event.id}`;
}

export function groupReplayTimeline<T extends ReplayEvent>(events: readonly T[], mode: GameMode) {
  const groups: { key: string; round: number; phase: string; phaseLabel: string; events: T[] }[] = [];
  for (const event of events) {
    const previous = groups.at(-1);
    // A resumed phase is a new segment, not a reason to move events before the pause.
    if (previous && previous.round === event.round && previous.phase === event.phase) {
      previous.events.push(event);
    } else {
      groups.push({ key: `phase-${groups.length + 1}`, round: event.round, phase: event.phase,
        phaseLabel: replayPhaseLabel(event.phase, mode), events: [event] });
    }
  }
  return groups;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function role(value: unknown) {
  const code = text(value);
  if (!code) return undefined;
  try { return getRoleNameBg(code as RoleCode); } catch { return "Неизвестна роля"; }
}

export function replayWinner(winner: string | null, mode: GameMode) {
  const labels: Record<string, string> = {
    village: mode === "werewolves_classic" ? "Селото печели" : "Гражданите печелят",
    werewolves: "Върколаците печелят", vampires: "Вампирите печелят", mafia: "Мафията печели",
    maniac: "Маниакът печели", lovers: "Влюбените печелят", draw: "Няма победител",
  };
  return winner ? labels[winner] ?? "Победителят не е записан" : "Резултатът не е записан";
}

export function replayPhaseLabel(phase: string, mode: GameMode) {
  const phases = ["lobby", "role_reveal", "first_night", "night", "day_announcement", "day_discussion",
    "nomination", "defense", "voting", "resolution", "hunter_revenge", "mayor_successor", "paused", "game_over"];
  return phases.includes(phase) ? phaseLabelBg(phase as GamePhase, mode) : "Неизвестна фаза";
}

export function replayEventLabel(type: string) {
  const labels: Record<string, string> = {
    room_created: "Създадена стая", game_started: "Начало на играта", player_joined: "Играч влезе", player_left: "Играч излезе",
    phase_change: "Смяна на фаза", role_assignment: "Раздадени роли", night_action_submitted: "Нощно действие",
    vote_submitted: "Глас", vote_tally: "Преброяване", nomination_submitted: "Номинация",
    death: "Смърт", reveal: "Разкриване", narrator_action: "Разказвач", game_over: "Край",
    personal_win: "Лична победа", jester_personal_win: "Лична победа", night_death_prevented: "Предотвратена смърт",
    game_paused: "Пауза", game_resumed: "Играта продължава",
  };
  return labels[type] ?? "Друго събитие";
}

export function replayVisibilityLabel(visibility: string) {
  const labels: Record<string, string> = { public: "публично", private: "лично", faction: "отборно", moderator: "за разказвача" };
  return labels[visibility] ?? "неуточнена видимост";
}

export function replayEventTone(type: string) {
  if (type === "death") return "danger";
  if (type.includes("vote") || type === "nomination_submitted") return "vote";
  if (type === "game_over") return "victory";
  return "neutral";
}

/** Receives only the viewer-authorized timeline and roster. Never looks up hidden roles. */
export function formatReplayEvent(event: ReplayEvent, names: ReadonlyMap<string, string>, mode: GameMode) {
  const payload = record(event.payload);
  const actor = (event.actorId && names.get(event.actorId)) ?? text(payload.actorNameBg) ?? text(payload.actorName);
  const target = (event.targetId && names.get(event.targetId)) ?? text(payload.targetNameBg) ?? text(payload.targetName);
  const actorLabel = actor || "Играчът";
  const targetLabel = target || "избрания играч";
  const roleName = role(payload.role) ?? (text(payload.roleNameBg)?.match(/[\u0400-\u04ff]/) ? text(payload.roleNameBg) : undefined);
  if (event.type === "game_started") return "Играта започна. Ролите са раздадени.";
  if (event.type === "vote_submitted") {
    return payload.skipped === true || payload.target === "skip"
      ? `${actorLabel} се въздържа от глас.` : `${actorLabel} гласува за ${targetLabel}.`;
  }
  if (event.type === "nomination_submitted") return `${actorLabel} номинира ${targetLabel}.`;
  if (event.type === "role_assignment") return `${actorLabel} получи ${roleName ? `ролята ${roleName}` : "своята роля"}.`;
  if (event.type === "night_action_submitted") {
    const action = record(payload.action);
    const actions: Record<string, string> = {
      check_alignment: "провери отбора на", check_role: "провери ролята на", check_commissioner: "провери",
      investigator_check: "провери", healer_protect: "защити", faction_kill: "атакува",
      witch_heal: "използва лечебната отвара за", witch_poison: "използва отровата срещу", roleblock: "блокира", lawyer_cover: "прикрие",
      priest_bless: "благослови", medium_contact: "потърси връзка с", thief_steal: "открадне ролята на",
      stray_cat_choose: "проследи",
    };
    if (action.kind === "skip") return `${actorLabel} пропусна нощното действие.`;
    if (action.kind === "cupid_link") {
      return `${actorLabel} избра да свърже ${names.get(text(action.firstUserId) ?? "") ?? "един играч"} и ${names.get(text(action.secondUserId) ?? "") ?? "друг играч"}.`;
    }
    if (action.kind === "blacksmith_sword") {
      return `${actorLabel} избра да даде меч на ${names.get(text(action.receiverUserId) ?? "") ?? "играч"} срещу ${targetLabel}.`;
    }
    const verb = actions[text(action.kind) ?? ""];
    return event.targetId || target
      ? verb ? `${actorLabel} избра да ${verb} ${targetLabel}.` : `${actorLabel} избра ${targetLabel} за нощното си действие.`
      : `${actorLabel} направи нощния си избор.`;
  }
  if (event.type === "vote_tally" && Array.isArray(payload.tally)) {
    const votes = payload.tally.flatMap((item) => {
      const row = record(item);
      if (typeof row.count !== "number" || !Number.isFinite(row.count) || row.count < 0) return [];
      return [`${names.get(text(row.userId) ?? "") ?? "Играч"}: ${row.count}`];
    });
    return votes.length ? `${votes.join(" · ")}${payload.mayorTieBreakerApplied ? " · Кметът разреши равенството." : ""}` : "Няма подадени гласове.";
  }
  if (event.type === "death") {
    const revealedRole = role(payload.revealRole);
    return `${target || actor || "Играч"} напусна играта.${text(payload.causeBg) ? ` ${text(payload.causeBg)}` : ""}${revealedRole ? ` Разкрита роля: ${revealedRole}.` : ""}`;
  }
  if (event.type === "reveal" && Array.isArray(payload.roles)) {
    const revealed = payload.roles.flatMap((item) => {
      const entry = record(item);
      const revealedRole = role(entry.role);
      return revealedRole ? [`${names.get(text(entry.userId) ?? "") ?? "Играч"}: ${revealedRole}`] : [];
    });
    return revealed.length ? `Ролите на масата: ${revealed.join("; ")}.` : "Няма запазени разкрити роли.";
  }
  if (event.type === "reveal" && payload.personalWin === true) {
    return payload.role === "jester"
      ? `${target || "Играчът"} беше Шут и постигна лична победа.`
      : `${target || "Играчът"} постигна лична победа.`;
  }
  // Both legacy public and new private records identify the Jester in targetId.
  if (event.type === "jester_personal_win") return `${target || "Играчът"} постигна лична победа като Шут.`;
  if (event.type === "game_over") return replayWinner(text(payload.winnerTeam) ?? null, mode);
  if (event.type === "phase_change") {
    const phase = text(payload.phase) ?? event.phase;
    return phase === "game_over" ? "Играта приключи." : `Започва ${replayPhaseLabel(phase, mode).toLocaleLowerCase("bg-BG")}.`;
  }
  if (event.type === "player_joined") return `${text(payload.displayName) ?? actorLabel} ${payload.spectator === true ? "наблюдава играта" : "се присъедини към масата"}.`;
  if (event.type === "player_left") return `${actorLabel} излезе от стаята.`;
  const message = text(payload.messageBg) ?? text(payload.reasonBg) ?? text(payload.causeBg);
  if (message) return message;
  if (event.type === "personal_win") return `${target || actor || "Играчът"} постигна лична победа.`;
  if (roleName) return `роля: ${roleName}`;
  return "Няма допълнителни подробности в този запис.";
}

export function replayMode(config: unknown): GameMode {
  const mode = record(config).mode;
  return mode === "mafia_free" || mode === "mafia_sport" ? mode : "werewolves_classic";
}
export function replayModeLabel(mode: GameMode) {
  return mode === "werewolves_classic" ? "Върколак" : mode === "mafia_sport" ? "Спортна Мафия" : "Мафия";
}
export function replayDuration(start: Date | null, end: Date | null) {
  if (!start || !end) return "няма данни";
  const minutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60_000));
  return minutes < 60 ? `${minutes} мин.` : `${Math.floor(minutes / 60)} ч.${minutes % 60 ? ` ${minutes % 60} мин.` : ""}`;
}
