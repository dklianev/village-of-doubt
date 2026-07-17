import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FriendsClient } from "../../friends-client";

const copyTextToClipboard = vi.fn().mockResolvedValue(undefined);
const storedValues = new Map<string, string>();

Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: {
    clear: () => storedValues.clear(),
    getItem: (key: string) => storedValues.get(key) ?? null,
    removeItem: (key: string) => storedValues.delete(key),
    setItem: (key: string, value: string) => storedValues.set(key, value),
  },
});

vi.mock("@/lib/clipboard", () => ({
  copyTextToClipboard: (text: string) => copyTextToClipboard(text),
}));

describe("FriendsClient", () => {
  beforeEach(() => {
    window.localStorage.clear();
    copyTextToClipboard.mockClear();
    vi.spyOn(crypto, "randomUUID").mockReturnValue("friend-1");
  });

  it("presents an empty reserved table instead of a generic empty card", () => {
    render(<FriendsClient />);

    expect(screen.getByRole("region", { name: "Запазени места" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Масата още чака своята компания" })).toBeInTheDocument();
    expect(screen.getAllByTestId("empty-seat")).toHaveLength(6);
  });

  it("adds a guest to the local ledger and lets the host reserve their seat", async () => {
    const user = userEvent.setup();
    render(<FriendsClient />);

    await user.type(screen.getByLabelText("Име"), "Мила");
    await user.type(screen.getByLabelText("Бележка"), "Чете масата отлично");
    await user.click(screen.getByRole("button", { name: "Добави в гостовата книга" }));

    expect(screen.getByRole("heading", { name: "Мила" })).toBeInTheDocument();
    expect(screen.getByText("Чете масата отлично")).toBeInTheDocument();
    expect(screen.getByText("1 запазено място")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Избери Мила" }));

    expect(screen.getByRole("button", { name: "Отмени Мила" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("1 избран гост")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Покани избрани (1)" }));
    expect(copyTextToClipboard).toHaveBeenCalledWith(expect.stringContaining("Мила,"));
  });

  it("restores the guest ledger from local storage", async () => {
    window.localStorage.setItem(
      "werewolf-mafia-friends-v1",
      JSON.stringify([{ id: "stored-1", name: "Борис", note: "Винаги е разказвач" }]),
    );

    render(<FriendsClient />);

    await waitFor(() => expect(screen.getByRole("heading", { name: "Борис" })).toBeInTheDocument());
    expect(screen.getByText("Винаги е разказвач")).toBeInTheDocument();
  });
});
