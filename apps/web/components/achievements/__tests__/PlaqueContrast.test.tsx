import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "components/achievements/LegacyAchievements.module.css"), "utf8");

describe("silver plaque inscription contrast", () => {
  it.each(["--plaque-fg-color", "--plaque-muted-color", "--plaque-meta-color"])(
    "keeps %s readable even over the darkest possible texture pixels",
    (foregroundToken) => {
      const style = document.createElement("style");
      style.textContent = css;
      document.head.append(style);
      const plaque = document.createElement("article");
      plaque.className = "achievement-plaque";
      plaque.dataset.tier = "silver";
      plaque.dataset.locked = "false";
      document.body.append(plaque);

      try {
        const variables = new Map<string, string>();
        const rules = Array.from(style.sheet!.cssRules).filter((rule): rule is CSSStyleRule => "selectorText" in rule);
        for (const rule of rules) {
          const selector = rule.selectorText.replace(/:global\(([^()]+)\)/g, "$1");
          if (!plaque.matches(selector)) continue;
          for (let index = 0; index < rule.style.length; index += 1) {
            const name = rule.style.item(index);
            if (name.startsWith("--")) variables.set(name, rule.style.getPropertyValue(name).trim());
          }
        }

        const texture = rules.find((rule) => rule.selectorText === ":global(.achievement-plaque::before)")!;
        const shine = rules.find((rule) => rule.selectorText === ":global(.achievement-plaque::after)")!;
        const surface = rgb(variables.get("--plaque-bg-color")!);
        // Black is a conservative bound for both independently composited art layers.
        const background = surface.slice(0, 3).map((channel) => channel
          * (1 - opacity(texture.style, variables))
          * (1 - opacity(shine.style, variables)));
        const foreground = rgb(variables.get(foregroundToken)!);
        const alpha = foreground[3] ?? 1;
        const ink = foreground.slice(0, 3).map((channel, index) => channel * alpha + background[index]! * (1 - alpha));

        const ratio = (Math.max(luminance(ink), luminance(background)) + 0.05)
          / (Math.min(luminance(ink), luminance(background)) + 0.05);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      } finally {
        plaque.remove();
        style.remove();
      }
    },
  );
});

function opacity(style: CSSStyleDeclaration, variables: Map<string, string>) {
  const value = style.getPropertyValue("opacity").trim() || "1";
  const reference = /^var\((--[\w-]+),\s*([\d.]+)\)$/.exec(value);
  return Number(reference ? variables.get(reference[1]!) ?? reference[2] : value);
}

function rgb(value: string) {
  const probe = document.createElement("span");
  probe.style.color = value;
  document.body.append(probe);
  const result = getComputedStyle(probe).color.match(/[\d.]+/g)!.map(Number);
  probe.remove();
  return result;
}

function luminance(channels: number[]) {
  const linear = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
}
