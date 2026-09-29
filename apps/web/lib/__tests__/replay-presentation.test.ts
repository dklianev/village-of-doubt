import { describe, expect, it } from "vitest";
import { formatReplayEvent, groupReplayTimeline, parseReplayCursor, replayCursor, replayWinner, type ReplayEvent } from "../replay-presentation";

const event: ReplayEvent = { id: "00000000-0000-4000-8000-000000000001", type: "vote_submitted", phase: "voting",
  round: 2, actorId: "anna", targetId: "boris", payload: {}, visibility: "public", createdAt: new Date("2026-05-14T20:00:00Z") };
const names = new Map([["anna", "Анна"], ["boris", "Борис"]]);
const format = (fields: Partial<ReplayEvent>) => formatReplayEvent({ ...event, ...fields }, names, "werewolves_classic");
// GameRoom persists the submitted command, not the resolved attack outcome.
const attack: ReplayEvent = { ...event, type: "night_action_submitted", phase: "night", visibility: "moderator",
  payload: { action: { kind: "faction_kill", targetUserId: "boris" } } };
// Legacy public wins remain readable; current games retain the vote-time record privately.
const jesterWin: ReplayEvent = { ...event, type: "jester_personal_win", phase: "resolution", actorId: null, payload: {} };

describe("persisted replay event presentation", () => {
  it.each(["werewolves_classic", "mafia_free", "mafia_sport"] as const)("distinguishes missing outcomes from draws in %s without inferring winners", (mode) => {
    for (const [winnerTeam, label] of [[null, "Резултатът не е записан"], ["draw", "Няма победител"]] as const) {
      expect(replayWinner(winnerTeam, mode)).toBe(label);
      expect(formatReplayEvent({ ...event, type: "game_over", phase: "game_over", payload: {
        winnerTeam, role: "werewolf", personalWinnerPlayerIds: ["boris"],
      } }, names, mode)).toBe(label);
    }
    expect(formatReplayEvent({ ...event, type: "game_over", phase: "game_over", payload: {} }, names, mode))
      .toBe("Резултатът не е записан");
  });

  it("renders terminal roles from structured identities, respecting deleted and missing roles", () => {
    expect(format({ type: "reveal", phase: "game_over", payload: { roles: [
      { userId: "anna", role: "seer" }, { userId: "boris", role: "jester" },
      { userId: "deleted-id" }, { userId: "future-id", role: "future-role" },
    ] } })).toBe("Ролите на масата: Анна: Гадателка; Борис: Шут; Играч: Неизвестна роля.");
    expect(format({ type: "reveal", payload: { roles: [{ userId: "deleted-id" }] } }))
      .toBe("Няма запазени разкрити роли.");
  });
  it("renders terminal personal victory without relying on persisted display names", () => {
    expect(format({ type: "reveal", phase: "game_over", payload: { role: "jester", personalWin: true } }))
      .toBe("Борис беше Шут и постигна лична победа.");
    expect(format({ type: "reveal", targetId: null, payload: { personalWin: true } }))
      .toBe("Играчът постигна лична победа.");
  });
  it("resolves vote identities from authoritative roster even with an empty payload", () => {
    expect(format({})).toBe("Анна гласува за Борис.");
    expect(format({ payload: { skipped: true }, targetId: null })).toBe("Анна се въздържа от глас.");
    expect(format({ payload: { actorName: "old", targetName: "wrong" } })).toBe("Анна гласува за Борис.");
  });
  it("formats real array tally and death fields", () => {
    expect(format({ type: "vote_tally", payload: { tally: [{ userId: "boris", count: 3 }] } })).toBe("Борис: 3");
    expect(format({ type: "death", actorId: null, payload: { causeBg: "Елиминиран след гласуването.", revealRole: "werewolf" } }))
      .toBe("Борис напусна играта. Елиминиран след гласуването. Разкрита роля: Върколак.");
  });
  it("describes a submitted night action as intent, not a successful outcome", () => {
    expect(format({ type: "night_action_submitted", payload: { action: { kind: "witch_heal", targetUserId: "boris" } } }))
      .toBe("Анна избра да използва лечебната отвара за Борис.");
    expect(format({ type: "night_action_submitted", payload: { action: { kind: "cupid_link", firstUserId: "anna", secondUserId: "boris" } } }))
      .toBe("Анна избра да свърже Анна и Борис.");
  });
  it("keeps the shared faction_kill command neutral about team, role and outcome", () => {
    // The same stored shape is used by factions, vigilante, maniac and vampire_hunter.
    expect(format(attack)).toBe("Анна избра да атакува Борис.");
    expect(format({ ...attack, payload: { ...attack.payload as object, role: "maniac", success: true } }))
      .toBe("Анна избра да атакува Борис.");
  });
  it.each([
    { actorId: "unknown-actor", targetId: "unknown-target", expected: "Играчът избра да атакува избрания играч." },
    { actorId: null, targetId: "boris", expected: "Играчът избра да атакува Борис." },
    { actorId: "anna", targetId: null, expected: "Анна направи нощния си избор." },
  ])("handles attack identities $actorId / $targetId without exposing raw IDs", ({ expected, ...identities }) => {
    expect(format({ ...attack, ...identities })).toBe(expected);
  });
  it("names the Jester winner from the real public target-only event with an empty payload", () => {
    expect(format(jesterWin)).toBe("Борис постигна лична победа като Шут.");
    expect(format({ ...jesterWin, payload: { targetNameBg: "старо име" } }))
      .toBe("Борис постигна лична победа като Шут.");
  });
  it.each(["unknown-target", null, ""])("does not invent a Jester identity for target %s", (targetId) => {
    expect(format({ ...jesterWin, targetId, actorId: "anna" }))
      .toBe("Играчът постигна лична победа като Шут.");
  });
  it("uses an authorized legacy target name when the Jester is absent from the roster", () => {
    expect(format({ ...jesterWin, targetId: "legacy-target", payload: { targetNameBg: "Рада" } }))
      .toBe("Рада постигна лична победа като Шут.");
  });
  it.each([{}, null, { role: "jester" }, { role: "future-role" }, { winnerTeam: "maniac" },
    { assignments: [{ userId: "anna", role: "jester" }] }, { personalWinnerPlayerIds: ["anna"] }])(
    "keeps generic legacy personal_win records neutral without inferring a Jester: %j", (payload) => {
      expect(format({ type: "personal_win", targetId: null, payload }))
        .toBe("Анна постигна лична победа.");
    },
  );
  it("supports target-only and unnamed legacy personal winners", () => {
    expect(format({ ...jesterWin, type: "personal_win" })).toBe("Борис постигна лична победа.");
    for (const identities of [{ actorId: null, targetId: null }, { actorId: "unknown-actor", targetId: "unknown-target" }]) {
      expect(format({ type: "personal_win", ...identities })).toBe("Играчът постигна лична победа.");
    }
  });
  it.each(["messageBg", "reasonBg", "causeBg"])("preserves the legacy personal-win description in %s", (key) => {
    expect(format({ type: "personal_win", payload: { [key]: "Анна постигна личната си цел." } }))
      .toBe("Анна постигна личната си цел.");
  });
  it("supports authoritative start and terminal phase events without dumping assignments", () => {
    expect(format({ type: "game_started", payload: { assignments: [{ userId: "private-id", role: "seer" }] } }))
      .toBe("Играта започна. Ролите са раздадени.");
    expect(format({ type: "phase_change", phase: "game_over", payload: { phase: "game_over" } })).toBe("Играта приключи.");
  });
  it("does not invent a revealed role or dump unknown private payload keys", () => {
    expect(format({ type: "death", payload: { revealRole: null } })).not.toContain("Върколак");
    expect(format({ type: "unknown", payload: { secret: "do-not-render", targetUserId: "do-not-render" } })).not.toContain("do-not-render");
    expect(format({ actorId: "unknown-id", targetId: "missing-id" })).not.toMatch(/unknown-id|missing-id/);
  });
  it("keeps resumed phases after the pause in source order", () => {
    const events = [event, { ...event, id: "2", phase: "paused" }, { ...event, id: "3" }];
    const groups = groupReplayTimeline(events, "werewolves_classic");
    expect(groups.map((group) => group.phase)).toEqual(["voting", "paused", "voting"]);
    expect(groups.flatMap((group) => group.events.map((item) => item.id))).toEqual(events.map((item) => item.id));
    expect(new Set(groups.map((group) => group.key)).size).toBe(3);
  });
  it("validates cursor input and preserves timestamp and tie-break identifier", () => {
    expect(parseReplayCursor(replayCursor(event))).toEqual({ createdAt: event.createdAt, id: event.id });
    for (const invalid of [undefined, "broken", "invalid~00000000-0000-4000-8000-000000000001", `${event.createdAt.toISOString()}~not-uuid`, "x".repeat(101)]) {
      expect(parseReplayCursor(invalid)).toBeUndefined();
    }
  });
});
