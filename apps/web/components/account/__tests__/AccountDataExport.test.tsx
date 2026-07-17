import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AccountDataExport,
  buildCompleteAccountExport,
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
});

function memoryStorage(entries: Record<string, string>): Pick<Storage, "getItem"> {
  return {
    getItem(key) {
      return entries[key] ?? null;
    },
  };
}
