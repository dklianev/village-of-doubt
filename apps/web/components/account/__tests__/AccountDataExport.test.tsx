import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountDataExport } from "../AccountDataExport";
import {
  buildCompleteAccountExport,
  downloadCompleteAccountExport,
  fetchCompleteAccountExport,
  readAccountExportSettings,
} from "../account-export";

describe("AccountDataExport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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

  it.each([null, { getItem: () => { throw new DOMException("Storage denied", "SecurityError"); } }])(
    "preserves server data when optional local settings are unavailable", (storage) => {
      const serverData = { profile: { id: "synthetic-user" }, games: [exportGame("synthetic-game", ["synthetic-event"])] };
      expect(buildCompleteAccountExport(serverData, storage)).toEqual({
        ...serverData,
        settings: { theme: null, soundEnabled: null, cueMode: null, lastGameFamily: null },
      });
    },
  );

  it("keeps readable preferences when one storage key throws", () => {
    const storage = memoryStorage({
      "werewolf-theme": "light", "werewolf-cue-mode": "visual", "last-family": "mafia",
    });
    const getItem = storage.getItem;
    storage.getItem = (key) => {
      if (key === "werewolf-sound") throw new DOMException("Storage denied", "SecurityError");
      return getItem(key);
    };
    expect(readAccountExportSettings(storage)).toEqual({
      theme: "light", soundEnabled: null, cueMode: "visual", lastGameFamily: "mafia",
    });
  });

  it("downloads the completed server export when localStorage exists but getItem is denied", async () => {
    const getItem = vi.fn(() => { throw new DOMException("Storage denied", "SecurityError"); });
    const storageGetter = vi.spyOn(window, "localStorage", "get").mockReturnValue({ getItem } as unknown as Storage);
    vi.stubGlobal("fetch", vi.fn(async () => exportResponse([exportGame("synthetic-game", ["synthetic-event"])], false, false, 1, 1)));
    const createObjectURL = vi.fn((_blob: Blob | MediaSource) => "blob:synthetic-export");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", class extends URL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = revokeObjectURL;
    });
    let downloadedFilename = "";
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloadedFilename = this.download;
    });

    await expect(downloadCompleteAccountExport()).resolves.toBeUndefined();

    expect(storageGetter).toHaveBeenCalled();
    expect(getItem).toHaveBeenCalledTimes(4);
    expect(click).toHaveBeenCalledOnce();
    expect(downloadedFilename).toBe("account.json");
    const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
    const content = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsText(blob);
    });
    expect(JSON.parse(content)).toMatchObject({
      profile: { id: "user-1" },
      games: [exportGame("synthetic-game", ["synthetic-event"])],
      pagination: { complete: true },
      settings: { theme: null, soundEnabled: null, cueMode: null, lastGameFamily: null },
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

  it.each([
    [429, { "Retry-After": "120" }, "Направи твърде много опити за изтегляне. Опитай отново след 2 минути."],
    [429, {}, "Направи твърде много опити за изтегляне. Опитай отново след малко."],
    [409, {}, "Данните ти се промениха, докато ги подготвяхме. Опитай отново."],
    [401, {}, "Сесията ти е изтекла. Влез отново, за да изтеглиш данните."],
  ])("explains a %i export refusal instead of the generic failure", async (status, headers, message) => {
    const fetcher = vi.fn(async () => new Response(null, { status, headers }));
    vi.stubGlobal("fetch", fetcher);
    const user = userEvent.setup();
    render(<AccountDataExport />);

    await user.click(screen.getByRole("button", { name: "Изтегли моите данни (JSON)" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("изтегля всички страници и слива събитията без дублиране", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(exportResponse([exportGame("game-1", ["event-1"])], true, true, 1, 1))
      .mockResolvedValueOnce(exportResponse([exportGame("game-1", ["event-2", "event-1"])], false, false, 1, 2, "continuation-2"))
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
    expect(fetcher.mock.calls[2]?.[1]?.headers).toEqual({
      Accept: "application/json",
      "X-Account-Export-Continuation": "continuation-2",
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
  continuation = "continuation-1",
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
        "X-Account-Export-Continuation": continuation,
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
