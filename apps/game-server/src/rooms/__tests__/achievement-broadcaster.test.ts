import { describe, expect, it, vi } from "vitest";
import { AchievementBroadcaster } from "../achievement-broadcaster.js";

describe("AchievementBroadcaster", () => {
  it("evaluates unlocks from recorded room events", () => {
    const broadcaster = new AchievementBroadcaster();
    broadcaster.recordEvent({
      phase: "first_night",
      type: "death",
      targetId: "player-1",
      payload: {},
    });

    expect(broadcaster.evaluateUnlocks({ players: [{ userId: "player-1" }] })).toContainEqual({
      userId: "player-1",
      achievementId: "first_blood",
    });
  });

  it("does not let chat overflow displace achievement gameplay events", () => {
    const broadcaster = new AchievementBroadcaster();
    broadcaster.recordEvent({
      phase: "first_night",
      type: "death",
      targetId: "player-1",
      payload: {},
    });

    for (let index = 0; index < 500; index += 1) {
      broadcaster.recordEvent({
        phase: "day_discussion",
        type: "chat",
        actorId: "player-2",
        payload: { message: `чат ${index}` },
      });
    }

    expect(broadcaster.evaluateUnlocks({ players: [{ userId: "player-1" }] })).toContainEqual({
      userId: "player-1",
      achievementId: "first_blood",
    });
  });

  it("announces each known unlock once per user", () => {
    const broadcaster = new AchievementBroadcaster();
    const sendToUser = vi.fn();

    broadcaster.announce(
      [
        { userId: "player-1", achievementId: "jester_win" },
        { userId: "player-1", achievementId: "jester_win" },
        { userId: "player-1", achievementId: "unknown" },
      ],
      sendToUser,
    );
    broadcaster.announce([{ userId: "player-1", achievementId: "jester_win" }], sendToUser);

    expect(sendToUser).toHaveBeenCalledOnce();
    expect(sendToUser).toHaveBeenCalledWith("player-1", ["jester_win"]);
  });

  it("reset clears announcement history", () => {
    const broadcaster = new AchievementBroadcaster();
    const sendToUser = vi.fn();

    broadcaster.announce([{ userId: "player-1", achievementId: "jester_win" }], sendToUser);
    broadcaster.reset();
    broadcaster.announce([{ userId: "player-1", achievementId: "jester_win" }], sendToUser);

    expect(sendToUser).toHaveBeenCalledTimes(2);
  });
});
