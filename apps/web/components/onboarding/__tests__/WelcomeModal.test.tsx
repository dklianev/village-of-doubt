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
    storage.getItem.mockReset();
    storage.setItem.mockReset();
    storage.getItem.mockReturnValue(null);
  });

  it("opens as a labelled modal and focuses the tutorial action", async () => {
    render(<WelcomeModal displayName="Демо играч" />);

    const dialog = await screen.findByRole("dialog", { name: "Мястото ти е готово." });
    const tutorialLink = screen.getByRole("link", { name: "Отвори наръчника" });

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(tutorialLink).toHaveAttribute("href", "/tutorial?welcome=1");
    expect(tutorialLink).toHaveFocus();
  });

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

  it("stays hidden after the tutorial is completed", () => {
    storage.getItem.mockImplementation((key: string) => (key === "tutorial-completed" ? "1" : null));

    render(<WelcomeModal displayName="Демо играч" />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(storage.setItem).toHaveBeenCalledWith("welcome-modal-shown", "1");
  });
});
