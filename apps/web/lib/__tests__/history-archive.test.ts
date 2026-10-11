import { describe, expect, it } from "vitest";
import { archiveHref, parseArchiveSelection } from "../history-archive";

const id = "00000000-0000-4000-8000-000000000001";
describe("archive URL state", () => {
  it("keeps family and winner independent", () => {
    expect(parseArchiveSelection({ family: "mafia", outcome: "village", before: id })).toEqual({ family: "mafia", outcome: "village", before: id });
  });
  it("normalizes unknown values and malformed cursors", () => {
    expect(parseArchiveSelection({ family: "unknown", outcome: "win", before: "bad" })).toEqual({ family: "all", outcome: "all" });
  });
  it("handles repeated query parameters and conflicting directions deterministically", () => {
    expect(parseArchiveSelection({ family: ["werewolves", "mafia"], before: id, after: id }))
      .toEqual({ family: "werewolves", outcome: "all", before: id });
  });
  it("round-trips filter and pagination state without unrelated query parameters", () => {
    const selection = { family: "mafia", outcome: "lovers", after: id } as const;
    const href = archiveHref(selection);
    expect(parseArchiveSelection(Object.fromEntries(new URL(href, "http://localhost").searchParams))).toEqual(selection);
    expect(archiveHref({ family: "all", outcome: "all" })).toBe("/history");
  });
});
