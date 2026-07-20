import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PLAY_STAGE_CSS = readFileSync(resolve(process.cwd(), "components/play/PlayStage.module.css"), "utf8");

function ruleDeclarations(stylesheet: string, selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return stylesheet.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, "s"))?.[1] ?? "";
}

describe("PlayStage seat geometry contracts", () => {
  it("anchors desktop seat coordinates to the portrait diameter", () => {
    const seatSlotRule = ruleDeclarations(PLAY_STAGE_CSS, ".seatSlot");

    expect(seatSlotRule).toContain("height: var(--seat-visual-size, 66px);");
    expect(seatSlotRule).toContain("align-content: start;");
    expect(seatSlotRule).toContain("transform: translate(-50%, -50%);");
  });

  it.each(["mobile-table-grid", "dense-table-grid"])(
    "restores content-sized seats in %s mode",
    (layoutMode) => {
      const gridSeatRule = ruleDeclarations(
        PLAY_STAGE_CSS,
        `.stage[data-layout-mode="${layoutMode}"] .seatSlot`,
      );

      expect(gridSeatRule).toContain("height: auto;");
      expect(gridSeatRule).toContain("align-content: normal;");
      expect(gridSeatRule).toContain("transform: none;");
    },
  );
});
