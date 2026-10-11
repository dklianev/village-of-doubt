import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameRulesPage } from "../game-rules-page";

vi.mock("next/link", () => ({
  default: ({ prefetch, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) => (
    <a data-prefetch={String(prefetch)} {...props} />
  ),
}));

const rulesCss = readFileSync(resolve(process.cwd(), "components/games/GameRulesPage.module.css"), "utf8");

describe("rules hero image loading", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  });

  it.each(["werewolves", "mafia"] as const)("resolves the selected %s theme without OS-theme image preloads", (family) => {
    const { container } = render(<GameRulesPage family={family} />);
    expect(container.querySelector("script")?.textContent).toContain("document.documentElement.dataset.theme");
    expect(container.querySelector('link[rel="preload"]')).toBeNull();
  });

  it("не prefetch-ва другата игра и вторичните route дървета от hero действията", () => {
    render(GameRulesPage({ family: "werewolves" }));

    for (const link of screen.getAllByRole("link").filter((link) => link.getAttribute("href")?.startsWith("/"))) {
      expect(link).toHaveAttribute("data-prefetch", "false");
    }
  });

  it("does not retain superseded first-pass phase board declarations", () => {
    expect(rulesCss).not.toContain("phase-loop-arrow");
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
    expect(phaseArt).toHaveAttribute("width", "1484");
    expect(phaseArt).toHaveAttribute("height", "1060");
    expect(phaseArt!.srcset).toMatch(/\d+w/);
    expect(phaseArt!.sizes).not.toBe("");
    expect(rulesCss).toContain("content-visibility: auto");
    expect(rulesCss).toContain("contain-intrinsic-size:");
  });

  it.each([
    ["werewolves", "/game-art/rules/werewolf-secret-card-v1.webp", "/game-art/werewolf/bg-hero-light-v1.webp"],
    ["mafia", "/game-art/phase-board/v1/mafia/icon-phase-role-reveal-1120.webp", "/game-art/phase-board/v1/mafia/icon-phase-day-1120.webp"],
  ] as const)("uses the high-density %s board crop without expanding small rail thumbnails", (family, roleRevealSrc, daySrc) => {
    const { container } = render(<GameRulesPage family={family} />);
    const phaseSources = Array.from(container.querySelectorAll<HTMLImageElement>(".phase-node-medallion")).map(
      (image) => new URL(image.src).searchParams.get("url"),
    );

    expect(phaseSources).toContain(roleRevealSrc);
    expect(phaseSources).toContain(daySrc);
    expect(phaseSources.every((source) => !source?.includes("role_reveal") && !source?.includes("day_discussion"))).toBe(true);
  });

  it.each(["werewolves", "mafia"] as const)("matches all six %s phase images to their native metadata", async (family) => {
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(0);
    const { container } = render(<GameRulesPage family={family} />);
    const buttons = container.querySelectorAll<HTMLButtonElement>(".phase-node");
    expect(buttons).toHaveLength(6);

    for (const button of buttons) {
      const thumbnail = button.querySelector("img")!;
      const source = new URL(thumbnail.src).searchParams.get("url")!;
      const metadata = await sharp(resolve(process.cwd(), "public", source.slice(1))).metadata();
      expect(thumbnail).toHaveAttribute("width", String(metadata.width));
      expect(thumbnail).toHaveAttribute("height", String(metadata.height));
      fireEvent.click(button);
      const detail = container.querySelector<HTMLImageElement>(".phase-detail-art img")!;
      expect(new URL(detail.src).searchParams.get("url")).toBe(source);
      expect(detail).toHaveAttribute("width", String(metadata.width));
      expect(detail).toHaveAttribute("height", String(metadata.height));
      expect(detail.sizes).toContain("(max-width: 760px) 1px");
    }

    if (family === "werewolves") {
      const day = container.querySelector<HTMLImageElement>('[data-phase="day_discussion"] img')!;
      expect(day.sizes).toBe("(max-width: 760px) 207px, 242px");
    }
  });
});
