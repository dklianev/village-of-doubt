import { describe, expect, it } from "vitest";
import {
  filterReplayTimelineByVisibility,
  loadReplayTimelineForViewer,
  resolveReplayTimelineVisibility,
} from "../replay-visibility";

const endedGame = {
  gameId: "game-1",
  status: "ended",
  endedAt: new Date("2026-07-29T20:00:00.000Z"),
  hostId: "host-1",
};

describe("post-game replay visibility", () => {
  it.each([
    ["домакин", "host-1", new Set<string>()],
    ["участник", "player-1", new Set(["game-1"])],
  ])("дава пълния запис само на %s на приключила игра", (_label, viewerUserId, participantGameIds) => {
    expect(
      resolveReplayTimelineVisibility({
        ...endedGame,
        viewerUserId,
        participantGameIds,
      }),
    ).toBe("all");
  });

  it.each([
    ["гост без сесия", undefined, new Set<string>()],
    ["външен потребител", "outsider-1", new Set<string>()],
    ["участник в друга игра", "player-1", new Set(["game-2"])],
  ])("ограничава %s до публичните събития", (_label, viewerUserId, participantGameIds) => {
    expect(
      resolveReplayTimelineVisibility({
        ...endedGame,
        viewerUserId,
        participantGameIds,
      }),
    ).toBe("public");
  });

  it.each([
    ["домакин", "host-1", new Set<string>()],
    ["участник", "player-1", new Set(["game-1"])],
  ])("не разкрива пълния запис на %s преди играта да е приключила", (_label, viewerUserId, participantGameIds) => {
    expect(
      resolveReplayTimelineVisibility({
        ...endedGame,
        status: "active",
        endedAt: null,
        viewerUserId,
        participantGameIds,
      }),
    ).toBe("public");
  });

  it.each([
    ["гост без сесия", undefined],
    ["външен потребител", "outsider-1"],
  ])("никога не връща private, faction или moderator събития на %s", (_label, viewerUserId) => {
    const visibility = resolveReplayTimelineVisibility({
      ...endedGame,
      viewerUserId,
      participantGameIds: new Set<string>(),
    });
    const timeline = filterReplayTimelineByVisibility(
      [
        { id: "public-1", visibility: "public" },
        { id: "private-1", visibility: "private" },
        { id: "faction-1", visibility: "faction" },
        { id: "moderator-1", visibility: "moderator" },
      ],
      visibility,
    );

    expect(timeline.map((event) => event.id)).toEqual(["public-1"]);
  });

  it("иска само публичния запис за външен потребител и филтрира неочаквани тайни редове", async () => {
    const requestedVisibilities: string[] = [];

    const timeline = await loadReplayTimelineForViewer({
      game: endedGame,
      viewerUserId: "outsider-1",
      loadParticipantGameIds: async () => new Set<string>(),
      loadTimeline: async (visibility) => {
        requestedVisibilities.push(visibility);
        return [
          { id: "public-1", visibility: "public" },
          { id: "private-1", visibility: "private" },
          { id: "faction-1", visibility: "faction" },
          { id: "moderator-1", visibility: "moderator" },
        ];
      },
    });

    expect(requestedVisibilities).toEqual(["public"]);
    expect(timeline.map((event) => event.id)).toEqual(["public-1"]);
  });
});
