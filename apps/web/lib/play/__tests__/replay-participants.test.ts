import { describe, expect, it } from "vitest";
import { collectReplayParticipants } from "../replay-participants";

describe("replay participants", () => {
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
