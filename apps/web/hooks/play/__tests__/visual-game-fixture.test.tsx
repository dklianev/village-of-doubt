import { describe, expect, it, vi } from "vitest";
import { parseVisualGameFixture } from "../visual-game-fixture";

vi.mock("@/components/play-room-client", () => ({ PlayRoomClientCore: () => null }));

function fixture(query: string) {
  const result = parseVisualGameFixture(`?visualGame=1&${query}`, "VISUAL", undefined, "test");
  expect(result).not.toBeNull();
  return result!;
}

describe("visual playroom fidelity", () => {
  it("supports classic Mafia without sport-only speeches or nominations", () => {
    const { snapshot } = fixture("family=mafia&mode=mafia_free&phase=day_discussion");
    expect(snapshot.mode).toBe("mafia_free");
    expect(snapshot.currentSpeakerUserId).toBe("");
    expect(snapshot.nominations).toEqual([]);
    expect(snapshot.tempoProfile).toBe("normal_online");
    expect(fixture("family=mafia&mode=mafia_free&phase=voting").snapshot.allowSkipVote).toBe(true);
  });

  it("supports explicit sport Mafia and preserves existing Mafia URLs", () => {
    const { snapshot } = fixture("family=mafia&mode=mafia_sport&phase=day_discussion");
    expect(snapshot.mode).toBe("mafia_sport");
    expect(snapshot.currentSpeakerUserId).not.toBe("");
    expect(snapshot.nominations).not.toHaveLength(0);
    expect(snapshot.tempoProfile).toBe("sport_mafia");
    expect(fixture("family=mafia&phase=voting").snapshot.mode).toBe("mafia_sport");
    expect(fixture("family=mafia&mode=mafia_sport&phase=voting").snapshot.allowSkipVote).toBe(false);
  });

  it("infers the family from an explicit mode and respects creation options", () => {
    expect(fixture("mode=mafia_free").snapshot.mode).toBe("mafia_free");
    expect(parseVisualGameFixture("?visualGame=1", "VISUAL", { mode: "mafia_free" }, "test")?.snapshot.mode).toBe("mafia_free");
    expect(fixture("family=werewolves&mode=mafia_free").snapshot.mode).toBe("werewolves_classic");
  });

  it.each(["seer", "oracle"])("matches the production boolean result for %s without revealing an exact role", (role) => {
    const result = fixture(`family=werewolves&role=${role}&phase=day_discussion`);
    expect(result.privateResult).toEqual({
      targetUserId: "visual-player-2",
      isEvil: true,
      messageBg: "Видението потвърди нощна заплаха.",
    });
    expect(result.snapshot.players[1]?.revealedRole).toBe("");
  });

  it.each(["lobby", "role_reveal", "first_night"])("does not invent a completed investigation during %s", (phase) => {
    expect(fixture(`family=werewolves&role=seer&phase=${phase}`).privateResult).toBeNull();
  });

  it("models the active Hunter as eliminated in the revenge preset", () => {
    const result = fixture("preset=hunter_revenge");
    expect(result.snapshot.players.find((player) => player.userId === result.currentUserId)?.alive).toBe(false);
    expect(result.privateRole?.role).toBe("hunter");
  });

  it("uses citizens, not the village, for a Mafia village-team winner", () => {
    expect(fixture("family=mafia&winner=village").snapshot.winnerReasonBg).toContain("Гражданите");
    expect(fixture("family=mafia&winner=village").snapshot.winnerReasonBg).not.toContain("Селото");
  });

  it("keeps narrator role assignments aligned when the viewer is not playing", () => {
    const result = fixture("family=werewolves&viewer=narrator");
    expect(result.narratorSnapshot?.roles.find((item) => item.userId === "visual-player-2")?.role).toBe("werewolf");
  });

  it.each(["mafia_sport", "mafia_free", "werewolves_classic"])("keeps feasible ballots and eligible targets in %s", (mode) => {
    for (const players of [3, 10, 30]) {
      for (const dead of [0, 1, players - 1]) {
        for (const viewer of ["alive", "dead", "narrator", "spectator"]) {
          for (const voteTally of ["empty", "full", "tie"]) {
            const query = `mode=${mode}&phase=voting&players=${players}&dead=${dead}&viewer=${viewer}&voteTally=${voteTally}`;
            const { snapshot } = fixture(query);
            const living = snapshot.players.filter((player) => player.playing && player.alive);
            const voters = snapshot.players.filter((player) => player.hasVoted);
            const nominees = snapshot.nominations ?? [];
            const eligible = snapshot.revoteEligibleUserIds ?? [];
            const total = snapshot.voteTally.reduce((sum, item) => sum + item.count, 0);
            expect(voters.every((voter) => living.includes(voter)), query).toBe(true);
            expect(total, query).toBe(voters.length);
            expect(new Set(nominees.map((item) => item.nominatorUserId)).size, query).toBe(nominees.length);
            for (const nomination of nominees) {
              expect(living.some((player) => player.userId === nomination.nominatorUserId), query).toBe(true);
              expect(living.some((player) => player.userId === nomination.targetUserId), query).toBe(true);
              expect(nomination.nominatorUserId, query).not.toBe(nomination.targetUserId);
            }
            for (const item of snapshot.voteTally) {
              expect(living.find((player) => player.userId === item.targetUserId)?.displayName, query).toBe(item.targetName);
              expect(item.count, query).toBeGreaterThan(0);
              expect(item.count, query).toBeLessThanOrEqual(voters.filter((voter) => voter.userId !== item.targetUserId).length);
              if (mode === "mafia_sport") {
                expect(nominees.some((nomination) => nomination.targetUserId === item.targetUserId), query).toBe(true);
              }
              if (item.hasMayorVote) {
                expect(voters.some((voter) => voter.mayor && voter.userId !== item.targetUserId), query).toBe(true);
              }
            }
            expect(snapshot.voteTally.filter((item) => item.hasMayorVote), query).toHaveLength(voters.some((player) => player.mayor) ? 1 : 0);
            if (voteTally === "empty") {
              expect(snapshot.voteTally, query).toEqual([]);
            }
            if (voteTally === "tie" && snapshot.voteTally.length > 0) {
              expect(snapshot.voteTally.length, query).toBeGreaterThanOrEqual(2);
              expect(new Set(snapshot.voteTally.map((item) => item.count)).size, query).toBe(1);
              expect(eligible, query).toEqual(snapshot.voteTally.map((item) => item.targetUserId));
              expect(snapshot.votingCycle, query).toBe(2);
            } else {
              expect(eligible, query).toEqual([]);
            }
          }
        }
      }
    }
  });

  it.each(["mafia_sport", "mafia_free", "werewolves_classic"])("preserves populated and tied ballots in %s", (mode) => {
    const full = fixture(`mode=${mode}&phase=voting&players=10&dead=2&voteTally=full`).snapshot;
    expect(full.voteTally.map((item) => item.count)).toEqual(mode === "mafia_sport" ? [2, 1] : [3, 2, 1]);
    const tie = fixture(`mode=${mode}&phase=voting&players=10&dead=2&voteTally=tie`).snapshot;
    expect(tie.voteTally.map((item) => item.count)).toEqual(mode === "mafia_sport" ? [2, 2] : [2, 2, 2]);
    expect(tie.revoteEligibleUserIds).toHaveLength(mode === "mafia_sport" ? 2 : 3);
    if (mode === "mafia_sport") {
      expect(full.voteTally.map((item) => item.targetName)).toEqual(["Вера", "Георги"]);
      expect(full.voteTally.every((item) => !item.hasMayorVote)).toBe(true);
    }
  });

  it.each(["lobby", "role_reveal", "first_night", "night", "day_announcement", "day_discussion", "nomination", "defense", "voting", "resolution", "hunter_revenge", "mayor_successor", "paused", "game_over"])("reports only concrete public facts during %s", (phase) => {
    for (const mode of ["mafia_sport", "mafia_free", "werewolves_classic"]) {
      for (const players of [3, 10, 30]) {
        for (const dead of [0, 1, players - 1]) {
          const { snapshot } = fixture(`mode=${mode}&phase=${phase}&players=${players}&dead=${dead}&voteTally=full`);
          const deaths = snapshot.players.filter((player) => player.playing && !player.alive);
          const events = snapshot.publicEvents;
          expect(events.filter((event) => event.type === "death")).toHaveLength(deaths.length);
          for (const player of deaths) {
            expect(events.some((event) => event.type === "death" && event.messageBg.includes(player.displayName))).toBe(true);
          }
          expect(events.map((event) => event.messageBg).join(" ")).not.toMatch(/визуал|проверка|тайна карта|На площада вече липсва един глас/);
          for (const event of events) {
            for (const player of snapshot.players.filter((player) => player.alive)) {
              if (event.type === "death") expect(event.messageBg).not.toContain(`${player.displayName} `);
            }
          }
          if (phase !== "voting") {
            expect(snapshot.voteTally).toEqual([]);
            expect(snapshot.players.some((player) => player.hasVoted)).toBe(false);
            expect(snapshot.revoteEligibleUserIds).toEqual([]);
          }
          if (["lobby", "role_reveal", "first_night"].includes(phase)) expect(deaths).toEqual([]);
        }
      }
    }
  });

  it("names the actual sport nominees, speaker and defender in the public log", () => {
    for (const phase of ["day_discussion", "defense", "voting"]) {
      const { snapshot } = fixture(`mode=mafia_sport&phase=${phase}&players=10&voteTally=full`);
      const publicNominations = snapshot.publicEvents.filter((event) => event.type === "nomination");
      expect(publicNominations).toHaveLength(snapshot.nominations!.length);
      for (const nomination of snapshot.nominations!) {
        const nominator = snapshot.players.find((player) => player.userId === nomination.nominatorUserId)!;
        const target = snapshot.players.find((player) => player.userId === nomination.targetUserId)!;
        expect(publicNominations.some((event) => event.messageBg.includes(nominator.displayName) && event.messageBg.includes(target.displayName))).toBe(true);
      }
      const activeId = phase === "defense" ? snapshot.currentDefenseUserId : snapshot.currentSpeakerUserId;
      if (activeId) {
        const active = snapshot.players.find((player) => player.userId === activeId)!;
        expect(snapshot.publicEvents.find((event) => event.type === "phase")?.messageBg).toContain(active.displayName);
      }
    }
  });
});
