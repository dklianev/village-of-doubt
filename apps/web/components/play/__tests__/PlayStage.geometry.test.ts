import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PLAY_STAGE_CSS = readFileSync(resolve(process.cwd(), "components/play/PlayStage.module.css"), "utf8");

function ruleDeclarations(stylesheet: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return stylesheet.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "s"))?.[1] ?? "";
}

describe("PlayStage seat geometry contracts", () => {
  it("anchors desktop seats while reserving a minimum pointer target and label space", () => {
    const seatSlotRule = ruleDeclarations(PLAY_STAGE_CSS, ".seatSlot");

    expect(seatSlotRule).toContain("width: max(var(--seat-hit-size, 44px), calc(var(--seat-visual-size, 66px) + 12px));");
    expect(seatSlotRule).toContain("min-height: var(--seat-hit-size, 44px);");
    expect(seatSlotRule).toContain("place-items: center;");
    expect(seatSlotRule).toContain("transform: translate(-50%, -50%);");
  });

  it.each(["mobile-table-grid", "dense-table-grid"])(
    "restores content-sized seats in %s mode",
    (layoutMode) => {
      const gridSeatRule = ruleDeclarations(
        PLAY_STAGE_CSS,
        `.stage[data-layout-mode="${layoutMode}"] .seatSlot`,
      );

      expect(gridSeatRule).toContain("position: relative;");
      expect(gridSeatRule).toContain("width: auto;");
      expect(gridSeatRule).toContain("min-height: 44px;");
      expect(gridSeatRule).not.toMatch(/(?:^|;)\s*height:/);
      expect(gridSeatRule).toContain("transform: none;");
    },
  );
});
