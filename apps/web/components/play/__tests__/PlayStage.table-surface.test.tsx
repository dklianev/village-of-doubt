import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PLAY_STAGE_CSS = readFileSync(resolve(process.cwd(), "components/play/PlayStage.module.css"), "utf8");
const PLAY_STAGE_SOURCE = readFileSync(resolve(process.cwd(), "components/play/PlayStage.tsx"), "utf8");

const TABLE_ASSETS = [
  "public/game-art/play/table-inlay-werewolves-v1.avif",
  "public/game-art/play/table-inlay-werewolves-v1.webp",
  "public/game-art/play/table-inlay-mafia-v1.avif",
  "public/game-art/play/table-inlay-mafia-v1.webp",
  "public/game-art/mobile/play/table-inlay-werewolves-v1.avif",
  "public/game-art/mobile/play/table-inlay-werewolves-v1.webp",
  "public/game-art/mobile/play/table-inlay-mafia-v1.avif",
  "public/game-art/mobile/play/table-inlay-mafia-v1.webp",
] as const;

describe("PlayStage table surface", () => {
  it("ships optimized faction material fallbacks within the route art budget", () => {
    for (const asset of TABLE_ASSETS) {
      const absolutePath = resolve(process.cwd(), asset);

      expect(existsSync(absolutePath), asset).toBe(true);
      expect(statSync(absolutePath).size, asset).toBeLessThan(800 * 1024);
    }
  });

  it("keeps the decorative inlay below interaction without adding a continuous compositor layer", () => {
    expect(PLAY_STAGE_CSS).toContain(".tableSurface::before");
    expect(PLAY_STAGE_CSS).toContain("pointer-events: none;");
    expect(PLAY_STAGE_CSS).toContain("overflow: hidden;");
    expect(PLAY_STAGE_CSS).toContain("var(--play-table-phase-light)");
    expect(PLAY_STAGE_CSS).not.toMatch(/\.tableSurface::(?:before|after)\s*\{[^}]*(?:animation|will-change):/s);
  });

  it("uses dedicated family art and a reduced-detail mobile source", () => {
    expect(PLAY_STAGE_CSS).toContain("table-inlay-werewolves-v1.avif");
    expect(PLAY_STAGE_CSS).toContain("table-inlay-mafia-v1.avif");
    expect(PLAY_STAGE_CSS).toContain("/game-art/mobile/play/table-inlay-werewolves-v1.webp");
    expect(PLAY_STAGE_CSS).toContain("/game-art/mobile/play/table-inlay-mafia-v1.webp");
    expect(PLAY_STAGE_CSS).toContain("/game-art/mobile/play/table-inlay-werewolves-v1.avif");
    expect(PLAY_STAGE_CSS).toContain("/game-art/mobile/play/table-inlay-mafia-v1.avif");
  });

  it("keeps the mobile table visible before ResizeObserver finishes measuring", () => {
    expect(PLAY_STAGE_SOURCE).toMatch(
      /const effectiveMode:[\s\S]*!hasMeasured\s*\?\s*"mobile-table-grid"/,
    );
    expect(PLAY_STAGE_SOURCE).toContain(
      'style={effectiveMode.endsWith("table-grid") ? undefined : seatStyle(geometry)}',
    );
    expect(PLAY_STAGE_CSS).toMatch(
      /@media \(min-width: 1024px\)[\s\S]*\.stage:not\(\[data-layout-ready="true"\]\) \.tableScene\s*\{\s*opacity:\s*0;/,
    );
    expect(PLAY_STAGE_CSS).toMatch(
      /\.stage:not\(\[data-layout-ready="true"\]\)\[data-layout-mode="mobile-table-grid"\]\s*\{[\s\S]*min-height:\s*clamp\(460px, 58svh, 650px\)/,
    );
    expect(PLAY_STAGE_CSS).toMatch(
      /\[data-seat-count="5"\],[\s\S]*\[data-seat-count="9"\][\s\S]*\{\s*min-height:\s*641px;/,
    );
    expect(PLAY_STAGE_CSS).toMatch(
      /@media \(max-width: 430px\) and \(max-height: 640px\)[\s\S]*grid-template-columns:\s*repeat\(4,[\s\S]*--seat-visual-size:\s*44px/,
    );
  });
});
