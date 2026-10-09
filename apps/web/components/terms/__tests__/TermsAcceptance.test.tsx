import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TermsAcceptance } from "../TermsAcceptance";

const key = "terms-read-version";
const version = "2026-05-19";
const readAt = "2026-05-20T12:00:00.000Z";

describe("local terms read marker", () => {
  beforeEach(() => window.localStorage.clear());

  it("stores only a version and read date without claiming acceptance or associating a user", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<TermsAcceptance />);
    expect(screen.getByText(/Не е свързана с досие и не записва съгласие/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Отбележи като прочетено" }));
    expect(screen.getByRole("status")).toHaveTextContent("Отбелязано като прочетено");
    expect(screen.getByText("Запазено само в този браузър.")).toBeVisible();
    const stored = JSON.parse(window.localStorage.getItem(key)!);
    expect(Object.keys(stored).sort()).toEqual(["readAt", "version"]);
    expect(stored.version).toBe(version);
    expect(Number.isFinite(Date.parse(stored.readAt))).toBe(true);
    expect(screen.queryByText(/Прочетен и приет|Подписвам/)).not.toBeInTheDocument();
    unmount();
    render(<TermsAcceptance />);
    expect(screen.getByRole("status")).toHaveTextContent("Отбелязано като прочетено");
  });

  it("restores a valid current-version marker", () => {
    window.localStorage.setItem(key, JSON.stringify({ version, readAt }));
    const { container } = render(<TermsAcceptance />);
    expect(container.querySelector("time")).toHaveAttribute("datetime", readAt);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it.each([
    "not-json", "null", "[]", "42", '"text"', "{}",
    JSON.stringify({ version: "2026-01-01", readAt }),
    JSON.stringify({ version, readAt: null }),
    JSON.stringify({ version, readAt: 123 }),
    JSON.stringify({ version, readAt: {} }),
    JSON.stringify({ version, readAt: "not-a-date" }),
    JSON.stringify({ version, readAt: "2026-06-31T12:00:00.000Z" }),
    JSON.stringify({ version, readAt: "2026-05-18T12:00:00.000Z" }),
    JSON.stringify({ version, readAt: "9999-01-01T00:00:00.000Z" }),
  ])("ignores invalid persisted data without crashing: %s", (raw) => {
    window.localStorage.setItem(key, raw);
    render(<TermsAcceptance />);
    expect(screen.getByRole("button", { name: "Отбележи като прочетено" })).toBeEnabled();
    expect(screen.queryByText("Отбелязано като прочетено")).not.toBeInTheDocument();
    expect(window.localStorage.getItem(key)).toBe(raw);
  });

  it("does not reinterpret the old browser-level acceptance as a new read marker", () => {
    window.localStorage.setItem("terms-accepted-version", JSON.stringify({ version, acceptedAt: readAt }));
    render(<TermsAcceptance />);
    expect(screen.getByRole("button", { name: "Отбележи като прочетено" })).toBeEnabled();
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it.each(["getter", "methods"] as const)("survives storage %s denial and does not claim to save", async (failure) => {
    const user = userEvent.setup();
    const denied = () => { throw new DOMException("synthetic-denial", "SecurityError"); };
    if (failure === "getter") {
      vi.spyOn(window, "localStorage", "get").mockImplementation(denied);
    } else {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(denied);
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(denied);
    }
    render(<TermsAcceptance />);
    await user.click(screen.getByRole("button", { name: "Отбележи като прочетено" }));
    expect(screen.getByRole("status")).toHaveTextContent("Отметката е само за тази отворена страница.");
    expect(screen.queryByText("Запазено само в този браузър.")).not.toBeInTheDocument();
  });
});
