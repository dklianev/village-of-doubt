import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { GameMode, GamePhase, TerminalGameResult, WinnerTeam } from "@werewolf/shared";
import { createNarrationCueTracker, narrationOccurrence, readNarrationTerminalResult, selectNarrationCues } from "../narration-cues";

const scene = (phase: GamePhase = "night", mode: GameMode = "werewolves_classic") => ({
  mode, phase, narration: { gameId: "room-instance-a", round: 2, votingCycle: 1, participantIds: ["a", "b", "c"] },
});
function finale(winner: WinnerTeam = "werewolves", personal = false) {
  const result: TerminalGameResult = { winnerTeam: winner, winnerPlayerIds: winner === "draw" ? [] : ["a"],
    personalWinnerPlayerIds: personal ? ["c"] : [],
    finalRoles: [{ userId: "a", role: "werewolf" }, { userId: "b", role: "ordinary_villager" }, { userId: "c", role: "jester" }] };
  return { ...scene("game_over"), narration: { ...scene().narration, winnerTeam: winner, terminalResult: result,
    terminalResultGameId: "room-instance-a", terminalResultRound: 2 } };
}

describe("public narration cue selection", () => {
  it("maps core phases for each family without loading any source texts", () => {
    for (const mode of ["werewolves_classic", "mafia_free", "mafia_sport"] as const) {
      for (const phase of ["role_reveal", "first_night", "night", "day_announcement", "day_discussion", "voting", "resolution"] as const) {
        expect(selectNarrationCues(scene(phase, mode))).toEqual([`${mode === "werewolves_classic" ? "werewolves" : "mafia"}.phase.${phase.replaceAll("_", ".")}`]);
      }
    }
  });
  it("limits sport phases and public interruptions to the actual mode", () => {
    for (const phase of ["nomination", "defense"] as const) {
      expect(selectNarrationCues(scene(phase, "mafia_sport"))).toHaveLength(1);
      expect(selectNarrationCues(scene(phase, "mafia_free"))).toEqual([]);
      expect(selectNarrationCues(scene(phase))).toEqual([]);
    }
    for (const phase of ["hunter_revenge", "mayor_successor"] as const) {
      expect(selectNarrationCues(scene(phase))).toHaveLength(1);
      expect(selectNarrationCues(scene(phase, "mafia_free"))).toEqual([]);
    }
    expect(selectNarrationCues(scene("paused"))).toEqual([]);
    expect(selectNarrationCues(scene("lobby"))).toEqual([]);
  });
  it("requires actual instance identity and a new ballot cycle", () => {
    expect(narrationOccurrence({ mode: "mafia_free", phase: "night" })).toBeNull();
    const voting = scene("voting");
    expect(narrationOccurrence(voting)).not.toEqual(narrationOccurrence({ ...voting, narration: { ...voting.narration, votingCycle: 2 } }));
    expect(narrationOccurrence({ ...voting, narration: { ...voting.narration, votingCycle: undefined } })).toBeNull();
  });
  it("plays personal victory only after the verified main finale including draw", () => {
    expect(selectNarrationCues(finale())).toEqual(["werewolves.finale.werewolves"]);
    expect(selectNarrationCues(finale("werewolves", true))).toEqual(["werewolves.finale.werewolves", "shared.personal.finale.jester"]);
    expect(selectNarrationCues(finale("draw", true))).toEqual(["shared.finale.draw", "shared.personal.finale.jester"]);
    expect(selectNarrationCues({ ...finale("werewolves", true), phase: "resolution" })).toEqual(["werewolves.phase.resolution"]);
  });
  it("rejects incomplete, conflicting, wrong-family, wrong-roster and fabricated personal results", () => {
    const good = finale("werewolves", true);
    const n = good.narration;
    expect(selectNarrationCues({ ...good, narration: { ...n, terminalResult: undefined } })).toEqual([]);
    expect(selectNarrationCues({ ...good, narration: { ...n, winnerTeam: "village" } })).toEqual([]);
    expect(selectNarrationCues({ ...good, mode: "mafia_free" })).toEqual([]);
    expect(selectNarrationCues({ ...good, narration: { ...n, participantIds: ["d", "e", "f"] } })).toEqual([]);
    expect(selectNarrationCues({ ...good, narration: { ...n, terminalResult: { ...n.terminalResult, personalWinnerPlayerIds: ["b"] } } })).toEqual([]);
    expect(selectNarrationCues({ ...good, narration: { ...n, terminalResult: { ...n.terminalResult, winnerPlayerIds: [] } } })).toEqual([]);
  });
  it.each(["village", "mafia", "maniac", "lovers", "draw"] as const)("maps the valid mafia finale %s", winner => {
    const s = finale(winner, true);
    s.mode = "mafia_free";
    s.narration.terminalResult.finalRoles = [{ userId: "a", role: "mafioso" }, { userId: "b", role: "civilian" }, { userId: "c", role: "jester" }];
    expect(selectNarrationCues(s)).toEqual([winner === "draw" ? "shared.finale.draw" : `mafia.finale.${winner}`, "shared.personal.finale.jester"]);
  });

  it("accepts the supported manual Mafia lovers role without admitting Werewolf-only Cupid", () => {
    const s = finale("lovers", true);
    s.mode = "mafia_free";
    s.narration.terminalResult.finalRoles = [{ userId: "a", role: "lovers" }, { userId: "b", role: "mafioso" }, { userId: "c", role: "jester" }];
    s.narration.terminalResult.winnerPlayerIds = ["a", "b"];
    expect(selectNarrationCues(s)).toEqual(["mafia.finale.lovers", "shared.personal.finale.jester"]);
    expect(selectNarrationCues({ ...s, mode: "mafia_sport" })).toEqual([]);
    s.narration.terminalResult.finalRoles[0]!.role = "cupid";
    expect(selectNarrationCues(s)).toEqual([]);
  });

  it("rejects an old or unbound terminal result even when the new game has identical players and winner", () => {
    const previous = finale("werewolves", true);
    const next = { ...previous, narration: { ...previous.narration, gameId: "room-instance-b" } };
    expect(selectNarrationCues(next)).toEqual([]);
    const { terminalResultGameId: _origin, ...unbound } = previous.narration;
    expect(selectNarrationCues({ ...previous, narration: unbound })).toEqual([]);
    expect(selectNarrationCues({ ...previous, narration: { ...previous.narration, terminalResultRound: 1 } })).toEqual([]);
  });

  it("only binds a terminal result from the matching authoritative room, phase and round", () => {
    const s = finale();
    const room = { roomId: "room-instance-a", state: { phase: "game_over", round: 2, winnerTeam: "werewolves",
      terminalResultJson: JSON.stringify(s.narration.terminalResult) } };
    expect(readNarrationTerminalResult(room, "room-instance-a", 2)).toEqual({
      terminalResult: s.narration.terminalResult, terminalResultGameId: "room-instance-a", terminalResultRound: 2,
    });
    expect(readNarrationTerminalResult(room, "room-instance-b", 2)).toEqual({});
    expect(readNarrationTerminalResult(room, "room-instance-a", 3)).toEqual({});
    expect(readNarrationTerminalResult({ ...room, state: { ...room.state, phase: "night" } }, room.roomId, 2)).toEqual({});
    expect(readNarrationTerminalResult({ ...room, state: { ...room.state, terminalResultJson: "invalid" } }, room.roomId, 2)).toEqual({});
    expect(readNarrationTerminalResult({ ...room, state: { ...room.state, winnerTeam: "village" } }, room.roomId, 2)).toEqual({});
  });

  it("covers every automatic source catalog cue and uses real catalog IDs in every sport phase", () => {
    const catalog = JSON.parse(readFileSync(resolve(process.cwd(), "../../assets/narration-source/catalog.v1.json"), "utf8")) as {
      cues: Array<{ id: string; family: string; kind: string; phase?: GamePhase; winner?: WinnerTeam }>;
    };
    const ids = new Set(catalog.cues.map(c => c.id));
    const selected = new Set<string>();
    for (const mode of ["werewolves_classic", "mafia_free", "mafia_sport"] as const) {
      for (const cue of catalog.cues.filter(c => c.kind === "phase")) {
        for (const id of selectNarrationCues(scene(cue.phase!, mode))) { expect(ids.has(id), `${mode}:${id}`).toBe(true); selected.add(id); }
      }
      for (const winner of ["village", "werewolves", "vampires", "mafia", "maniac", "lovers", "draw"] as const) {
        const s = finale(winner, mode !== "mafia_sport");
        s.mode = mode;
        if (mode !== "werewolves_classic") s.narration.terminalResult.finalRoles = [
          { userId: "a", role: "mafioso" }, { userId: "b", role: "civilian" },
          { userId: "c", role: mode === "mafia_sport" ? "commissioner" : "jester" },
        ];
        for (const id of selectNarrationCues(s)) { expect(ids.has(id), `${mode}:${id}`).toBe(true); selected.add(id); }
      }
    }
    expect([...selected].sort()).toEqual(catalog.cues.filter(c => c.kind !== "preview").map(c => c.id).sort());
    expect(selectNarrationCues(scene("nomination", "mafia_sport"))).toEqual(["mafia.phase.nomination"]);
    expect(selectNarrationCues(scene("defense", "mafia_sport"))).toEqual(["mafia.phase.defense"]);
  });
});

describe("narration occurrence tracking", () => {
  it("skips initial snapshots and same-phase updates but narrates a new phase once", () => {
    const tracker = createNarrationCueTracker();
    expect(tracker.update(scene(), true)).toBeNull();
    expect(tracker.update(scene(), true)).toBeNull();
    expect(tracker.update(scene("day_announcement"), true)?.cues).toEqual(["werewolves.phase.day.announcement"]);
    expect(tracker.update(scene("day_announcement"), true)).toBeNull();
  });
  it("does not replay mute/visibility/pause or interrupted resolution, but allows a new voting cycle", () => {
    const tracker = createNarrationCueTracker();
    tracker.update(scene("night"), true);
    expect(tracker.update(scene("day_announcement"), false)).toBeNull();
    expect(tracker.update(scene("day_announcement"), true)).toBeNull();
    expect(tracker.update(scene("resolution"), true)).not.toBeNull();
    tracker.update(scene("hunter_revenge"), true);
    expect(tracker.update(scene("resolution"), true)).toBeNull();
    tracker.update(scene("paused"), true);
    expect(tracker.update(scene("resolution"), true)).toBeNull();
    expect(tracker.update(scene("voting"), true)).not.toBeNull();
    expect(tracker.update({ ...scene("voting"), narration: { ...scene().narration, votingCycle: 2 } }, true)).not.toBeNull();
  });
  it("baselines a different game instance and a reconnect instead of announcing their current phase", () => {
    const tracker = createNarrationCueTracker();
    tracker.update(scene(), true);
    expect(tracker.update({ ...scene("voting"), narration: { ...scene().narration, gameId: "room-instance-b" } }, true)).toBeNull();
    tracker.reset();
    expect(tracker.update(finale(), true)).toBeNull();
  });
  it("briefly waits for terminal data arriving after game_over but never speaks a stale late result", () => {
    const tracker = createNarrationCueTracker();
    tracker.update(scene(), true, 0);
    expect(tracker.update(scene("game_over"), true, 1)).toBeNull();
    expect(tracker.update(finale(), true, 500)?.cues).toEqual(["werewolves.finale.werewolves"]);
    expect(tracker.update(finale(), true, 600)).toBeNull();
    tracker.reset(); tracker.update(scene(), true, 0); tracker.update(scene("game_over"), true, 1);
    expect(tracker.update(finale(), true, 5000)).toBeNull();
  });
  it("drops pending terminal announcements on a quiet/hidden update", () => {
    const tracker = createNarrationCueTracker();
    tracker.update(scene(), true, 0); tracker.update(scene("game_over"), true, 1);
    tracker.update(scene("game_over"), false, 2);
    expect(tracker.update(finale(), true, 500)).toBeNull();
  });

  it("ignores an old same-player result in a rematch and can accept the new room's bound result", () => {
    const tracker = createNarrationCueTracker();
    tracker.update(scene("resolution"), true, 0);
    expect(tracker.update(finale(), true, 1)).not.toBeNull();
    const newScene = { ...scene("night"), narration: { ...scene().narration, gameId: "room-instance-b" } };
    expect(tracker.update(newScene, true, 2)).toBeNull();
    const stale = { ...finale(), narration: { ...finale().narration, gameId: "room-instance-b" } };
    expect(tracker.update(stale, true, 3)).toBeNull();
    const fresh = { ...stale, narration: { ...stale.narration, terminalResultGameId: "room-instance-b" } };
    expect(tracker.update(fresh, true, 4)?.cues).toEqual(["werewolves.finale.werewolves"]);
  });
});
