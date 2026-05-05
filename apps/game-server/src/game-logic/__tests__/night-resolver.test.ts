import { describe, expect, it } from "vitest";
import { resolveNight, type PrivatePlayerForNight, type SubmittedNightAction } from "../night-resolver.js";

const players: PrivatePlayerForNight[] = [
  { userId: "civilian", role: "civilian", alive: true },
  { userId: "commissioner", role: "commissioner", alive: true },
  { userId: "don", role: "don", alive: true },
  { userId: "mafioso", role: "mafioso", alive: true },
  { userId: "werewolf", role: "werewolf", alive: true },
  { userId: "seer", role: "seer", alive: true },
  { userId: "witch", role: "witch", alive: true },
  { userId: "healer", role: "healer", alive: true },
  { userId: "bodyguard", role: "bodyguard", alive: true },
  { userId: "roleblocker", role: "roleblocker", alive: true },
  { userId: "lawyer", role: "lawyer", alive: true },
  { userId: "vigilante", role: "vigilante", alive: true },
  { userId: "priested", role: "ordinary_villager", alive: true, priestBlessed: true },
  { userId: "vampire", role: "vampire", alive: true },
  { userId: "jester", role: "jester", alive: true },
];

describe("resolveNight", () => {
  it("returns role and alignment checks without exposing them publicly", () => {
    const result = resolveNight(players, [
      action("commissioner", { kind: "check_alignment", targetUserId: "mafioso" }),
      action("don", { kind: "check_commissioner", targetUserId: "commissioner" }),
      action("seer", { kind: "check_role", targetUserId: "don" }),
    ]);

    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ actorUserId: "commissioner", targetUserId: "mafioso", isEvil: true }),
        expect.objectContaining({ actorUserId: "don", targetUserId: "commissioner", isCommissioner: true }),
        expect.objectContaining({ actorUserId: "seer", targetUserId: "don", role: "don" }),
      ]),
    );
    expect(result.deaths).toEqual([]);
  });

  it("resolves witch heal after faction kill regardless of submission order", () => {
    const result = resolveNight(players, [
      action("witch", { kind: "witch_heal", targetUserId: "civilian" }),
      action("mafioso", { kind: "faction_kill", targetUserId: "civilian" }),
    ]);

    expect(result.deaths).toEqual([]);
  });

  it("does not kill anyone when faction votes tie", () => {
    const result = resolveNight(players, [
      action("don", { kind: "faction_kill", targetUserId: "civilian" }),
      action("mafioso", { kind: "faction_kill", targetUserId: "commissioner" }),
    ]);

    expect(result.deaths).toEqual([]);
  });

  it("applies a unique faction kill and independent witch poison", () => {
    const result = resolveNight(players, [
      action("don", { kind: "faction_kill", targetUserId: "civilian" }),
      action("mafioso", { kind: "faction_kill", targetUserId: "civilian" }),
      action("witch", { kind: "witch_poison", targetUserId: "don" }),
    ]);

    expect(result.deaths).toEqual(
      expect.arrayContaining([
        { userId: "civilian", causeBg: "Убит от Мафията." },
        { userId: "don", causeBg: "Отровен от Вещицата." },
      ]),
    );
  });

  it("resolves werewolf kills immediately and vampire bites as delayed deaths", () => {
    const result = resolveNight(players, [
      action("werewolf", { kind: "faction_kill", targetUserId: "civilian" }),
      action("vampire", { kind: "faction_kill", targetUserId: "commissioner" }),
    ]);

    expect(result.deaths).toEqual(
      expect.arrayContaining([
        { userId: "civilian", causeBg: "Изяден от Върколаците." },
      ]),
    );
    expect(result.delayedDeaths).toEqual([{ userId: "commissioner", causeBg: "Умря от вампирско ухапване." }]);
  });

  it("lets the healer protect against a night kill", () => {
    const result = resolveNight(players, [
      action("werewolf", { kind: "faction_kill", targetUserId: "civilian" }),
      action("healer", { kind: "healer_protect", targetUserId: "civilian" }),
    ]);

    expect(result.deaths).toEqual([]);
  });

  it("keeps a priest blessing active after it protects the blessed player", () => {
    const result = resolveNight(players, [
      action("vampire", { kind: "faction_kill", targetUserId: "priested" }),
    ]);

    expect(result.deaths).toEqual([]);
    expect(result.delayedDeaths).toEqual([]);
    expect(result.protectedByPriest).toEqual(["priested"]);
  });

  it("shows the jester as an ordinary villager to the seer", () => {
    const result = resolveNight(players, [
      action("seer", { kind: "check_role", targetUserId: "jester" }),
    ]);

    expect(result.checks).toEqual([
      expect.objectContaining({ actorUserId: "seer", targetUserId: "jester", role: "ordinary_villager" }),
    ]);
  });

  it("lets the roleblocker stop another night action", () => {
    const result = resolveNight(players, [
      action("roleblocker", { kind: "roleblock", targetUserId: "vigilante" }),
      action("vigilante", { kind: "faction_kill", targetUserId: "mafioso" }),
    ]);

    expect(result.deaths).toEqual([]);
    expect(result.privateMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetUserId: "vigilante",
          messageBg: "Блокиращият спря нощното ти действие.",
        }),
      ]),
    );
  });

  it("lets the lawyer cover make an evil target look clean", () => {
    const result = resolveNight(players, [
      action("lawyer", { kind: "lawyer_cover", targetUserId: "mafioso" }),
      action("commissioner", { kind: "check_alignment", targetUserId: "mafioso" }),
      action("seer", { kind: "check_role", targetUserId: "mafioso" }),
    ]);

    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ actorUserId: "commissioner", targetUserId: "mafioso", isEvil: false }),
        expect.objectContaining({ actorUserId: "seer", targetUserId: "mafioso", role: "civilian" }),
      ]),
    );
  });

  it("makes the bodyguard absorb the death meant for the protected target", () => {
    const result = resolveNight(players, [
      action("bodyguard", { kind: "healer_protect", targetUserId: "commissioner" }),
      action("mafioso", { kind: "faction_kill", targetUserId: "commissioner" }),
      action("don", { kind: "faction_kill", targetUserId: "commissioner" }),
    ]);

    expect(result.deaths).toEqual([{ userId: "bodyguard", causeBg: "Загина, докато пазеше друг играч." }]);
    expect(result.preventedDeaths).toEqual([{ userId: "commissioner", reasonBg: "Бодигардът пое нощната атака." }]);
  });
});

function action(actorUserId: string, command: SubmittedNightAction["action"]): SubmittedNightAction {
  return {
    actorUserId,
    action: command,
  };
}
