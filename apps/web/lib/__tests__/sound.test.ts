import { describe, expect, it } from "vitest";
import { getSoundEnabled, playCue, setSoundEnabled, shouldPlayCue, SOUND_STORAGE_KEY } from "../sound";

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem(key: string) {
      return items.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      items.set(key, value);
    },
  };
}

describe("sound preferences", () => {
  it("persists the opt-in sound toggle", () => {
    const storage = memoryStorage();

    expect(getSoundEnabled(storage)).toBe(false);
    setSoundEnabled(true, storage);
    expect(storage.getItem(SOUND_STORAGE_KEY)).toBe("on");
    expect(getSoundEnabled(storage)).toBe(true);
    setSoundEnabled(false, storage);
    expect(storage.getItem(SOUND_STORAGE_KEY)).toBe("off");
    expect(getSoundEnabled(storage)).toBe(false);
  });

  it("does not play when disabled or forced silent", () => {
    const storage = memoryStorage();

    expect(shouldPlayCue({ storage })).toBe(false);
    expect(playCue("vote", { storage })).toBe(false);
    setSoundEnabled(true, storage);
    expect(shouldPlayCue({ storage })).toBe(true);
    expect(shouldPlayCue({ storage, forceSilent: true })).toBe(false);
  });
});
