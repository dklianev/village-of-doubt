import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AccountDataExport,
  buildCompleteAccountExport,
  fetchCompleteAccountExport,
  readAccountExportSettings,
} from "../AccountDataExport";

describe("AccountDataExport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("добавя валидните локални настройки към export файла", () => {
    const storage = memoryStorage({
      "werewolf-theme": "light",
      "werewolf-sound": "on",
      "werewolf-cue-mode": "audio_vibration",
      "last-family": "mafia",
    });

    expect(buildCompleteAccountExport({ profile: { id: "user-1" }, games: [] }, storage)).toEqual({
      profile: { id: "user-1" },
      games: [],
      settings: {
        theme: "light",
        soundEnabled: true,
        cueMode: "audio_vibration",
        lastGameFamily: "mafia",
      },
    });
  });

  it("не включва невалидни стойности като настройки", () => {
    const storage = memoryStorage({
      "werewolf-theme": "purple",
      "werewolf-sound": "yes",
      "werewolf-cue-mode": "loud",
      "last-family": "unknown",
    });

    expect(readAccountExportSettings(storage)).toEqual({
      theme: null,
      soundEnabled: null,
      cueMode: null,
      lastGameFamily: null,
    });
  });

  it("показва безопасна българска грешка при неуспешен export", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 500 })));
    const user = userEvent.setup();
    render(<AccountDataExport />);

    await user.click(screen.getByRole("button", { name: "Изтегли моите данни (JSON)" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Не успяхме да подготвим данните. Опитай отново.",
    );
  });

  it("изтегля всички страници и слива събитията без дублиране", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(exportResponse([exportGame("game-1", ["event-1"])], true, true, 1, 1))
      .mockResolvedValueOnce(exportResponse([exportGame("game-1", ["event-2", "event-1"])], true, false, 1, 2))
      .mockResolvedValueOnce(exportResponse([exportGame("game-2", ["event-3"])], false, false, 2, 1));

    const result = await fetchCompleteAccountExport(fetcher);

    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      expect.stringContaining("page=1&pageSize=100&eventPage=1&eventPageSize=1000"),
      expect.stringContaining("page=1&pageSize=100&eventPage=2&eventPageSize=1000&eventCursor=event-cursor-1"),
      expect.stringContaining("page=2&pageSize=100&eventPage=1&eventPageSize=1000&gameCursor=game-cursor-1"),
    ]);
    expect(fetcher.mock.calls[0]?.[1]?.headers).toEqual({ Accept: "application/json" });
    expect(fetcher.mock.calls[1]?.[1]?.headers).toEqual({
      Accept: "application/json",
      "X-Account-Export-Continuation": "continuation-1",
    });
    expect(result.data.games).toEqual([
      expect.objectContaining({
        id: "game-1",
        eventCount: 2,
        events: [{ id: "event-1" }, { id: "event-2" }],
      }),
      expect.objectContaining({ id: "game-2", events: [{ id: "event-3" }] }),
    ]);
    expect(result.data.pagination).toEqual(
      expect.objectContaining({ complete: true, requests: 3, gamePages: 2 }),
    );
  });
});

function exportGame(id: string, eventIds: string[]) {
  return { id, events: eventIds.map((eventId) => ({ id: eventId })), eventCount: eventIds.length };
}

function exportResponse(
  games: ReturnType<typeof exportGame>[],
  hasMore: boolean,
  eventsHasMore: boolean,
  page: number,
  eventPage: number,
) {
  const nextGameCursor = hasMore ? `game-cursor-${page}` : null;
  const nextEventCursor = eventsHasMore ? `event-cursor-${eventPage}` : null;
  return new Response(
    JSON.stringify({
      profile: { id: "user-1" },
      achievements: [],
      games,
      pagination: {
        page,
        pageSize: 100,
        hasMore,
        nextGameCursor,
        eventPage,
        eventPageSize: 1_000,
        eventsHasMore,
        nextEventCursor,
      },
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="account.json"',
        "X-Account-Export-Continuation": "continuation-1",
      },
    },
  );
}

function memoryStorage(entries: Record<string, string>): Pick<Storage, "getItem"> {
  return {
    getItem(key) {
      return entries[key] ?? null;
    },
  };
}
