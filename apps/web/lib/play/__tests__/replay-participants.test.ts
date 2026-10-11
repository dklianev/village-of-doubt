import { describe, expect, it } from "vitest";
import { collectReplayParticipants } from "../replay-participants";

describe("replay participants", () => {
  it("never renders internal identifiers when a participant name is missing", () => {
    const participants = collectReplayParticipants([], [{ actorId: "short-id", targetId: "long-internal-identifier", payload: {} }], false);
    expect(participants.map((participant) => participant.label)).toEqual(["Неназован участник", "Неназован участник"]);
  });
  it("marks spectators separately and preserves the marker on later events", () => {
    const participants = collectReplayParticipants([], [
      { actorId: "observer", targetId: null, payload: { displayName: "Неда", spectator: true } },
      { actorId: "observer", targetId: null, payload: {} },
    ], false);
    expect(participants).toEqual([{ id: "observer", label: "Неда", role: undefined, initial: "Н", spectator: true }]);
  });

  it("keeps different players with the same name distinct", () => {
    expect(collectReplayParticipants([
      { userId: "one", displayName: "Анна", role: null },
      { userId: "two", displayName: "Анна", role: null },
    ], [], false)).toHaveLength(2);
  });
  it("uses authoritative names and never copies the actor role to the target", () => {
    const participants = collectReplayParticipants(
      [
        { userId: "seer-1", displayName: "Анна", role: "seer" },
        { userId: "target-1", displayName: "Борис", role: "werewolf" },
      ],
      [
        {
          actorId: "seer-1",
          targetId: "target-1",
          payload: { actorNameBg: "Старо име", targetNameBg: "Друга цел", role: "seer" },
        },
      ],
      true,
    );

    expect(participants).toEqual([
      { id: "seer-1", label: "Анна", role: "Гадателка", initial: "А" },
      { id: "target-1", label: "Борис", role: "Върколак", initial: "Б" },
    ]);
  });

  it("keeps roles out of the public replay roster", () => {
    const participants = collectReplayParticipants(
      [{ userId: "seer-1", displayName: "Анна", role: null }],
      [],
      false,
    );

    expect(participants[0]).toEqual({ id: "seer-1", label: "Анна", role: undefined, initial: "А" });
  });
});
