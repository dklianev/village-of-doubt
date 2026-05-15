import { describe, expect, it } from "vitest";
import { topMoments, type HistoryTimelineEventView } from "../history-highlights";

function event(overrides: Partial<HistoryTimelineEventView>): HistoryTimelineEventView {
  return {
    id: "event-1",
    round: 1,
    phase: "resolution",
    type: "system",
    actorId: null,
    targetId: null,
    visibility: "public",
    payload: {},
    createdAt: "2026-05-15T20:30:00.000Z",
    ...overrides,
  };
}

describe("history highlights", () => {
  it("selects high-value events in timeline order", () => {
    const moments = topMoments([
      event({ id: "low", type: "chat_message" }),
      event({ id: "over", type: "game_over", round: 4 }),
      event({ id: "death", type: "death", round: 3 }),
    ]);

    expect(moments).toEqual([
      { id: "over", label: "Рунд 4: Развръзка на масата" },
      { id: "death", label: "Рунд 3: Смърт в нощта" },
    ]);
  });

  it("honors the requested limit", () => {
    const moments = topMoments(
      [
        event({ id: "reveal", type: "reveal", round: 2 }),
        event({ id: "vote", type: "vote_tally", round: 2 }),
      ],
      1,
    );

    expect(moments).toEqual([{ id: "reveal", label: "Рунд 2: Разкрита роля" }]);
  });

  it("uses the quiet-night fallback when no high-value events exist", () => {
    expect(topMoments([event({ id: "low", type: "phase_change" })])).toEqual([
      { id: "tiha-nosht", label: "Тиха нощ - без явни обрати." },
    ]);
  });
});
