import { preload } from "react-dom";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameRulesPage } from "../game-rules-page";

vi.mock("react-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-dom")>();
  return { ...actual, preload: vi.fn() };
});

vi.mock("next/link", () => ({
  default: ({ prefetch, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) => (
    <a data-prefetch={String(prefetch)} {...props} />
  ),
}));

const preloadMock = vi.mocked(preload);
const rulesCss = readFileSync(resolve(process.cwd(), "components/games/GameRulesPage.module.css"), "utf8");

describe("rules hero image loading", () => {
  beforeEach(() => preloadMock.mockClear());

  it.each([
    ["werewolves", "werewolf"],
    ["mafia", "mafia"],
  ] as const)("preloads responsive %s hero art at high priority", (family, path) => {
    GameRulesPage({ family });
    const mobileDarkVersion = family === "werewolves" ? "v3" : "v2";

    expect(preloadMock).toHaveBeenCalledTimes(4);
    expect(preloadMock).toHaveBeenCalledWith(`/game-art/${path}/bg-hero-v2.avif`, {
      as: "image",
      type: "image/avif",
      fetchPriority: "high",
      media: "(min-width: 721px) and (prefers-color-scheme: dark)",
    });
    expect(preloadMock).toHaveBeenCalledWith(`/game-art/mobile/${path}/bg-hero-light-v1.avif`, {
      as: "image",
      type: "image/avif",
      fetchPriority: "high",
      media: "(max-width: 720px) and (prefers-color-scheme: light)",
    });
    expect(preloadMock).toHaveBeenCalledWith(`/game-art/mobile/${path}/bg-hero-${mobileDarkVersion}.avif`, {
      as: "image",
      type: "image/avif",
      fetchPriority: "high",
      media: "(max-width: 720px) and (prefers-color-scheme: dark)",
    });
  });

  it("не prefetch-ва другата игра и вторичните route дървета от hero действията", () => {
    render(GameRulesPage({ family: "werewolves" }));

    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveAttribute("data-prefetch", "false");
    }
  });

  it("does not retain superseded first-pass phase board declarations", () => {
    expect(rulesCss).not.toContain("grid-template-columns: repeat(6, minmax(0, 1fr))");
    expect(rulesCss).not.toContain("padding: 24px 14px 104px");
    expect(rulesCss).not.toContain("border-radius: 34px");
  });

  it("defers phase art and below-fold rendering until they approach the viewport", () => {
    render(GameRulesPage({ family: "werewolves" }));

    const phaseArt = document.querySelector<HTMLImageElement>(".phase-node-medallion");
    expect(phaseArt).not.toBeNull();
    expect(phaseArt).toHaveAttribute("loading", "lazy");
    expect(phaseArt).toHaveAttribute("decoding", "async");
    expect(phaseArt).toHaveAttribute("fetchpriority", "low");
    expect(rulesCss).toContain("content-visibility: auto");
    expect(rulesCss).toContain("contain-intrinsic-size:");
  });

  it.each([
    ["werewolves", "/game-art/phase-board/v1/werewolves/icon-phase-role-reveal-560.webp", "/game-art/phase-board/v1/werewolves/icon-phase-day-560.webp"],
    ["mafia", "/game-art/phase-board/v1/mafia/icon-phase-role-reveal-560.webp", "/game-art/phase-board/v1/mafia/icon-phase-day-560.webp"],
  ] as const)("references the shipped %s phase-board files", (family, roleRevealSrc, daySrc) => {
    const { container } = render(<GameRulesPage family={family} />);
    const phaseSources = Array.from(container.querySelectorAll<HTMLImageElement>(".phase-node-medallion")).map(
      (image) => image.getAttribute("src"),
    );

    expect(phaseSources).toContain(roleRevealSrc);
    expect(phaseSources).toContain(daySrc);
    expect(phaseSources.every((source) => !source?.includes("role_reveal") && !source?.includes("day_discussion"))).toBe(true);
  });
});
