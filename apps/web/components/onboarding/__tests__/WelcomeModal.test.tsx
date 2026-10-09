import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WelcomeModal } from "../WelcomeModal";

const storage = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
}));

const navigation = vi.hoisted(() => ({ pathname: "/", search: "" }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

vi.mock("@/lib/safe-storage", () => ({
  safeLocalStorage: storage,
}));

describe("WelcomeModal", () => {
  it("keeps its actions scroll-accessible in short landscape viewports", () => {
    const source = readFileSync(resolve(process.cwd(), "components/onboarding/WelcomeModal.module.css"), "utf8");
    expect(source).toContain("min-height: min(500px, calc(100svh - 24px))");
    expect(source).toContain("@media (max-height: 560px)");
    expect(source).not.toContain("@media (max-height: 560px) and (max-width: 640px)");
  });
  beforeEach(() => {
    navigation.pathname = "/";
    navigation.search = "";
    storage.getItem.mockReset();
    storage.setItem.mockReset();
    storage.getItem.mockReturnValue(null);
  });

  it("opens as a labelled modal and focuses the tutorial action", async () => {
    render(<WelcomeModal displayName="Демо играч" />);

    const dialog = await screen.findByRole("dialog", { name: "Мястото ти е готово." });
    const tutorialLink = screen.getByRole("link", { name: "Отвори наръчника" });

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(tutorialLink).toHaveAttribute("href", "/tutorial?welcome=1&game=werewolves_classic");
    expect(tutorialLink).toHaveFocus();
  });

  it.each([
    ["/", "game=mafia_free&redirect=%2Fmafia%2Fjoin%2FABC234", "mafia_free", "/mafia/join/ABC234"],
    ["/account", "redirect=%2Fmafia%2Fjoin%2FABC234", "mafia_free", "/mafia/join/ABC234"],
    ["/account", "redirect=%2Fmafia%2Fcreate%3Fmode%3Dmafia_sport", "mafia_sport", "/mafia/create?mode=mafia_sport"],
    ["/werewolf/join/ABC234", "", "werewolves_classic", "/werewolf/join/ABC234"],
    ["/mafia/join/ABC234", "mode=mafia_sport", "mafia_sport", "/mafia/join/ABC234?mode=mafia_sport"],
    ["/mafia/join", "code=ABC234&mode=mafia_sport", "mafia_sport", "/mafia/join?code=ABC234&mode=mafia_sport"],
    ["/mafia/join", "code=ABC234", "mafia_free", "/mafia/join?code=ABC234"],
    ["/join", "code=ABC234&game=mafia_free", "mafia_free", "/join?code=ABC234&game=mafia_free"],
    ["/account", "game=mafia_sport&redirect=%2Fplay%2FABC234", "mafia_sport", "/play/ABC234"],
    ["/", "game=unknown&redirect=%2Fmafia%2Fjoin%2FABC234", "mafia_free", "/mafia/join/ABC234"],
  ])("preserves the tutorial family and destination from %s?%s", async (pathname, search, game, redirect) => {
    navigation.pathname = pathname;
    navigation.search = search;
    render(<WelcomeModal displayName="Демо играч" />);
    const link = await screen.findByRole("link", { name: "Отвори наръчника" });
    const url = new URL(link.getAttribute("href")!, "https://example.invalid");
    expect(url.pathname).toBe("/tutorial");
    expect(Object.fromEntries(url.searchParams)).toEqual({ welcome: "1", game, redirect });
  });

  it.each([
    ["/", "", "werewolves_classic"],
    ["/account", "", "werewolves_classic"],
    ["/mafia", "", "mafia_free"],
    ["/mafia/create", "mode=mafia_sport", "mafia_sport"],
    ["/account", "game=mafia_free", "mafia_free"],
    ["/werewolf", "", "werewolves_classic"],
  ])("infers the family on %s?%s without inventing an invitation", async (pathname, search, game) => {
    navigation.pathname = pathname;
    navigation.search = search;
    render(<WelcomeModal displayName="Демо играч" />);
    const link = await screen.findByRole("link", { name: "Отвори наръчника" });
    const url = new URL(link.getAttribute("href")!, "https://example.invalid");
    expect(Object.fromEntries(url.searchParams)).toEqual({ welcome: "1", game });
  });

  it.each(["https://external.invalid/", "//external.invalid/", "/%2fexternal.invalid/", "/mafia/../sign-in"])(
    "does not forward an unsafe redirect %s", async (redirect) => {
      navigation.search = new URLSearchParams({ redirect }).toString();
      render(<WelcomeModal displayName="Демо играч" />);
      const link = await screen.findByRole("link", { name: "Отвори наръчника" });
      const url = new URL(link.getAttribute("href")!, "https://example.invalid");
      expect(url.searchParams.has("redirect")).toBe(false);
    },
  );

  it("dismisses with Escape and remembers the choice", async () => {
    const user = userEvent.setup();
    render(<WelcomeModal displayName="Демо играч" />);

    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(storage.setItem).toHaveBeenCalledWith("welcome-modal-shown", "1");
  });

  it("keeps keyboard focus inside the open modal", async () => {
    const user = userEvent.setup();
    render(<WelcomeModal displayName="Демо играч" />);

    const tutorialLink = await screen.findByRole("link", { name: "Отвори наръчника" });
    const skipButton = screen.getByRole("button", { name: "Към игрите" });
    const closeButton = screen.getByRole("button", { name: "Затвори приветствието" });

    expect(tutorialLink).toHaveFocus();
    await user.tab();
    expect(skipButton).toHaveFocus();
    await user.tab();
    expect(closeButton).toHaveFocus();
    await user.tab({ shift: true });
    expect(skipButton).toHaveFocus();
  });

  it("isolates and restores the page behind the modal", async () => {
    const user = userEvent.setup();
    render(
      <>
        <a href="/history">Фоново съдържание</a>
        <WelcomeModal displayName="Демо играч" />
      </>,
    );

    await screen.findByRole("dialog");
    const backgroundLink = screen.getByText("Фоново съдържание");

    expect(backgroundLink).toHaveAttribute("inert");
    expect(backgroundLink).toHaveAttribute("aria-hidden", "true");

    await user.click(screen.getByRole("button", { name: "Затвори приветствието" }));

    expect(backgroundLink).not.toHaveAttribute("inert");
    expect(backgroundLink).not.toHaveAttribute("aria-hidden");
  });

  it("stays hidden after the tutorial is completed", () => {
    storage.getItem.mockImplementation((key: string) => (key === "tutorial-completed" ? "1" : null));

    render(<WelcomeModal displayName="Демо играч" />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(storage.setItem).toHaveBeenCalledWith("welcome-modal-shown", "1");
  });
});
