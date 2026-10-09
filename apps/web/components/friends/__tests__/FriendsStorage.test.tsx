import { beforeEach, describe, expect, it, vi } from "vitest";
import { safeLocalStorage } from "@/lib/safe-storage";
import { FRIENDS_STORAGE_KEY, FRIENDS_BACKUP_KEY, MAX_FRIENDS, parseFriends, readFriends, writeFriends } from "../friends-storage";

const friend = { id: "synthetic-1", name: "Мила", note: "Разказвач" };

describe("bounded local guest book", () => {
  beforeEach(() => localStorage.clear());

  it.each(["[null]", "{}", "null", "42", "false", "not-json", '[{"id":1,"name":"Мила","note":""}]'])("rejects %s without writing", (raw) => {
    localStorage.setItem(FRIENDS_STORAGE_KEY, raw);
    expect(readFriends()).toMatchObject({ friends: [], needsRecovery: true });
    expect(localStorage.getItem(FRIENDS_STORAGE_KEY)).toBe(raw);
  });

  it("keeps valid records, deduplicates IDs and normalized names, and rejects oversized text", () => {
    const raw = JSON.stringify([null, friend, { ...friend, id: "other", name: "  МИЛА " },
      { ...friend, name: "Друг" }, { id: "long", name: "Я".repeat(61), note: "" },
      { id: "note", name: "Анна", note: "я".repeat(241) }, { id: "valid-2", name: "Борис", note: "" }]);
    expect(parseFriends(raw)).toEqual({ friends: [friend, { id: "valid-2", name: "Борис", note: "" }], needsRecovery: true });
  });

  it("caps entries and refuses oversized serialized data", () => {
    const raw = JSON.stringify(Array.from({ length: MAX_FRIENDS + 1 }, (_, index) => ({ id: `fixture-${index}`, name: `Име ${index}`, note: "" })));
    expect(parseFriends(raw).friends).toHaveLength(MAX_FRIENDS);
    expect(parseFriends(raw).needsRecovery).toBe(true);
    expect(parseFriends(" ".repeat(128_001))).toEqual({ friends: [], needsRecovery: true });
  });

  it("reads legacy records without rewriting and preserves original bytes on explicit recovery", () => {
    const raw = JSON.stringify([null, friend], null, 2);
    localStorage.setItem(FRIENDS_STORAGE_KEY, raw);
    const snapshot = readFriends();
    expect(writeFriends(snapshot.friends, snapshot)).toBe("recovery");
    expect(localStorage.getItem(FRIENDS_STORAGE_KEY)).toBe(raw);
    expect(writeFriends(snapshot.friends, snapshot, true)).toBe("saved");
    expect(localStorage.getItem(FRIENDS_BACKUP_KEY)).toBe(raw);
    expect(JSON.parse(localStorage.getItem(FRIENDS_STORAGE_KEY)!)).toEqual([friend]);
  });

  it("does not overwrite a different existing recovery backup", () => {
    localStorage.setItem(FRIENDS_BACKUP_KEY, "older-backup");
    localStorage.setItem(FRIENDS_STORAGE_KEY, "[null]");
    expect(writeFriends([], readFriends(), true)).toBe("backup");
    expect(localStorage.getItem(FRIENDS_BACKUP_KEY)).toBe("older-backup");
    expect(localStorage.getItem(FRIENDS_STORAGE_KEY)).toBe("[null]");
  });

  it("preserves original data when backup cannot be saved", () => {
    localStorage.setItem(FRIENDS_STORAGE_KEY, "[null]");
    vi.spyOn(safeLocalStorage, "setItem").mockReturnValue(false);
    expect(writeFriends([], readFriends(), true)).toBe("unavailable");
    expect(localStorage.getItem(FRIENDS_STORAGE_KEY)).toBe("[null]");
  });

  it("fails without data loss on write denial or a cross-tab change", () => {
    const snapshot = readFriends();
    const write = vi.spyOn(safeLocalStorage, "setJson").mockReturnValue(false);
    expect(writeFriends([friend], snapshot)).toBe("unavailable");
    expect(localStorage.getItem(FRIENDS_STORAGE_KEY)).toBeNull();
    localStorage.setItem(FRIENDS_STORAGE_KEY, "[]");
    expect(writeFriends([friend], snapshot)).toBe("changed");
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("distinguishes inaccessible storage from an empty book", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("denied", "SecurityError"); });
    expect(readFriends()).toMatchObject({ unavailable: true, friends: [] });
  });
});
