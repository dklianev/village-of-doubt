import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import * as roleArt from "@/lib/role-art";
import { UniversalHowToPlay } from "../UniversalHowToPlay";

describe("homepage first-game guidance", () => {
  it("separates three preparation steps from the full game tutorial", () => {
    render(<UniversalHowToPlay />);
    const introduction = screen.getByRole("region", { name: "Първата ти игра" });
    const list = within(introduction).getByRole("list");
    expect(list.tagName).toBe("OL");
    const steps = within(list).getAllByRole("listitem");
    expect(steps).toHaveLength(3);
    expect(within(steps[0]!).getByRole("heading")).toHaveTextContent("Влез");
    expect(within(steps[1]!).getByRole("heading")).toHaveTextContent("Събери компанията");
    expect(within(steps[2]!).getByRole("heading")).toHaveTextContent("Получи роля");
    expect(within(introduction).getByRole("link", { name: /Виж как се играе/ })).toHaveAttribute("href", "/tutorial");
    expect(screen.queryByText(/30 секунди/i)).not.toBeInTheDocument();
  });

  it("introduces hidden roles with three decorative public card illustrations", () => {
    render(<UniversalHowToPlay />);
    const introduction = screen.getByRole("region", { name: "Първата ти игра" });
    expect(within(introduction).getByRole("heading", { level: 2 })).toHaveTextContent(
      /Познаваш хората\.\s*Не и ролите\./,
    );

    const deck = introduction.querySelector(".home-start-deck");
    expect(deck).toBeInTheDocument();
    const images = deck!.querySelectorAll("img");
    expect(images).toHaveLength(3);
    for (const image of images) {
      expect(image).toHaveAttribute("alt", "");
      expect(image.closest('[aria-hidden="true"]')).not.toBeNull();
      expect(image).toHaveAttribute("width", "520");
      expect(image).toHaveAttribute("height", "780");
      expect(image).toHaveAttribute("loading", "lazy");
      expect(image).toHaveAttribute("decoding", "async");
    }
    const sources = Array.from(images, (image) => image.getAttribute("src"));
    expect(sources).toEqual([
      roleArt.roleThumbPath("werewolves", "seer"),
      roleArt.roleThumbPath("mafia", "commissioner"),
      "/game-art/thumbs/card-back-secret.webp",
    ]);
    expect(within(introduction).queryByRole("img")).not.toBeInTheDocument();
  });

  it("preserves helper-provided thumbnail revisions without changing the secret card", () => {
    const seer = "/game-art/thumbs/role-seer.webp?test-revision=seer";
    const commissioner = "/game-art/thumbs/mafia/role-commissioner.webp?test-revision=commissioner";
    const thumbnail = vi.spyOn(roleArt, "roleThumbPath")
      .mockReturnValueOnce(seer)
      .mockReturnValueOnce(commissioner);
    const { container } = render(<UniversalHowToPlay />);

    expect(thumbnail).toHaveBeenNthCalledWith(1, "werewolves", "seer");
    expect(thumbnail).toHaveBeenNthCalledWith(2, "mafia", "commissioner");
    expect(thumbnail).toHaveBeenCalledTimes(2);
    expect(Array.from(container.querySelectorAll(".home-start-deck img"), (image) => image.getAttribute("src")))
      .toEqual([seer, commissioner, "/game-art/thumbs/card-back-secret.webp"]);
  });

  it("keeps the tutorial as the only action without live-game identifiers or fake controls", () => {
    render(<UniversalHowToPlay />);
    const introduction = screen.getByRole("region", { name: "Първата ти игра" });
    const tutorial = within(introduction).getByRole("link", { name: /Виж как се играе/ });
    expect(within(introduction).getAllByRole("link")).toEqual([tutorial]);
    expect(tutorial).toHaveAttribute("href", "/tutorial");
    expect(introduction.querySelectorAll('button, [role="button"], input, select, textarea')).toHaveLength(0);
    expect(introduction.querySelectorAll(
      '[aria-hidden="true"] a, [aria-hidden="true"] [tabindex]:not([tabindex="-1"])',
    )).toHaveLength(0);
    expect(introduction.querySelectorAll(
      "script, [aria-live], [data-player-id], [data-user-id], [data-session-id], [data-room-id], [data-role-id], [data-game-token]",
    )).toHaveLength(0);
  });
});
