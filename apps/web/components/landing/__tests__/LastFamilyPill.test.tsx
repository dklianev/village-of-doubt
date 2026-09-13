import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LastFamilyPill } from "@/components/landing/LastFamilyPill";

describe("LastFamilyPill", () => {
  beforeEach(() => {
    window.localStorage.removeItem("last-family");
  });

  afterEach(() => {
    window.localStorage.removeItem("last-family");
  });

  it.each(["werewolves", "mafia"] as const)("labels only the last viewed %s family without suggesting a resumable game", (family) => {
    window.localStorage.setItem("last-family", family);
    render(
      <>
        <section aria-label="Върколак"><LastFamilyPill family="werewolves" /></section>
        <section aria-label="Мафия"><LastFamilyPill family="mafia" /></section>
      </>,
    );

    const region = screen.getByRole("region", { name: family === "mafia" ? "Мафия" : "Върколак" });
    const label = within(region).getByText("Последно разглеждана");
    expect(screen.getAllByText("Последно разглеждана")).toHaveLength(1);
    expect(label).toHaveClass("mode-choice-continue-pill");
    expect(label.tagName).toBe("SPAN");
    expect(label).not.toHaveAttribute("tabindex");
    expect(label).not.toHaveAttribute("role");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText("Продължи")).not.toBeInTheDocument();
  });

  it.each([null, "", "werewolf", "MAFIA", '"mafia"', "unknown", "{invalid"])("does not label either family for invalid or missing storage: %s", (saved) => {
    if (saved !== null) window.localStorage.setItem("last-family", saved);

    const { container } = render(
      <>
        <LastFamilyPill family="werewolves" />
        <LastFamilyPill family="mafia" />
      </>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("stays hidden when the browser blocks local storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage is blocked", "SecurityError");
    });

    const { container } = render(<LastFamilyPill family="mafia" />);

    expect(container).toBeEmptyDOMElement();
  });
});
