import { preload } from "react-dom";
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

describe("rules hero image loading", () => {
  beforeEach(() => preloadMock.mockClear());

  it.each([
    ["werewolves", "werewolf"],
    ["mafia", "mafia"],
  ] as const)("preloads responsive %s hero art at high priority", (family, path) => {
    GameRulesPage({ family });

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
  });

  it("не prefetch-ва другата игра и вторичните route дървета от hero действията", () => {
    render(GameRulesPage({ family: "werewolves" }));

    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveAttribute("data-prefetch", "false");
    }
  });
});
