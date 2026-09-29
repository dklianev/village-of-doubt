import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const toolchain = createRequire(require.resolve("vitest/package.json"));
const { transform } = toolchain("lightningcss") as {
  transform(options: { filename: string; code: Buffer; cssModules: boolean }): { code: Buffer };
};
const filename = resolve(process.cwd(), "components/achievements/LegacyAchievements.module.css");
const css = transform({ filename, code: readFileSync(filename), cssModules: true }).code.toString();

describe("collection text palette across both material surfaces", () => {
  for (const theme of ["light", "dark"]) {
    it.each(["unselected", "selected", "filtered-empty", "unavailable"])(`${theme} %s has an opaque local surface with readable text`, (state) => {
      document.documentElement.dataset.theme = theme;
      const style = document.createElement("style");
      style.textContent = css;
      document.head.append(style);
      const shell = document.createElement("main");
      shell.className = "achievement-shell";
      const filters = document.createElement("div");
      filters.className = "achievement-filters";
      const target = document.createElement(state.endsWith("selected") ? "button" : "p");
      target.className = state === "unavailable" ? "achievement-load-state" : state === "filtered-empty" ? "achievement-filter-empty" : "";
      target.setAttribute("aria-pressed", String(state === "selected"));
      filters.append(target);
      shell.append(filters);
      document.body.append(shell);
      try {
        const declarations = new Map<string, string>();
        const rules = Array.from(style.sheet!.cssRules).filter((rule): rule is CSSStyleRule => "selectorText" in rule);
        for (const node of [shell, filters, target]) for (const rule of rules) {
          if (!node.matches(rule.selectorText)) continue;
          for (let index = 0; index < rule.style.length; index++) {
            const name = rule.style.item(index);
            declarations.set(name, rule.style.getPropertyValue(name).trim());
          }
        }
        const resolveValue = (value: string): string => value.replace(/var\((--[\w-]+)\)/g, (_, token: string) => resolveValue(declarations.get(token)!));
        const background = rgb(resolveValue(declarations.get("background")!));
        const ink = rgb(resolveValue(declarations.get("color")!));
        expect(background[3] ?? 1).toBe(1);
        expect((Math.max(luminance(ink), luminance(background)) + 0.05)
          / (Math.min(luminance(ink), luminance(background)) + 0.05)).toBeGreaterThanOrEqual(4.5);
      } finally {
        shell.remove(); style.remove(); delete document.documentElement.dataset.theme;
      }
    });

    for (const tier of ["bronze", "silver", "gold"]) {
      it.each(["true", "false"])(`${theme} ${tier}, locked=%s: every text color exceeds 4.5:1`, (locked) => {
        document.documentElement.dataset.theme = theme;
        const style = document.createElement("style");
        style.textContent = css;
        document.head.append(style);
        const shell = document.createElement("main");
        shell.className = "achievement-shell";
        const plaque = document.createElement("article");
        plaque.className = "achievement-plaque";
        plaque.dataset.tier = tier;
        plaque.dataset.locked = locked;
        const inscription = document.createElement("div");
        inscription.className = "achievement-plaque-inner";
        plaque.append(inscription);
        shell.append(plaque);
        document.body.append(shell);

        try {
          const rules = Array.from(style.sheet!.cssRules).filter((rule): rule is CSSStyleRule => "selectorText" in rule);
          const variables = new Map<string, string>();
          for (const node of [shell, plaque, inscription]) {
            for (const rule of rules) {
              if (!node.matches(rule.selectorText)) continue;
              for (let i = 0; i < rule.style.length; i++) {
                const name = rule.style.item(i);
                if (name.startsWith("--")) variables.set(name, rule.style.getPropertyValue(name).trim());
              }
            }
          }
          const resolveToken = (name: string): string => {
            const value = variables.get(name)!;
            const reference = /^var\((--[\w-]+)\)$/.exec(value);
            return reference ? resolveToken(reference[1]!) : value;
          };
          const surface = rules.find((rule) => rule.selectorText === ".achievement-shell .achievement-plaque")!;
          expect(surface.style.getPropertyValue("background")).toBe("");
          const inner = rules.find((rule) => rule.selectorText === ".achievement-shell .achievement-plaque-inner")!;
          expect(inner.style.getPropertyValue("background")).toBe("");
          const base = rgb(resolveToken("--plaque-bg-color"));
          // The low-opacity material may vary locally; keep a margin beyond the base color.
          const backgrounds = [base, base.map((channel) => theme === "light" ? Math.round(channel * 0.9) : Math.min(255, channel + 12))];
          for (const token of ["--plaque-fg-color", "--plaque-muted-color", "--plaque-meta-color"]) {
            const ink = rgb(resolveToken(token));
            expect(ink[3] ?? 1).toBe(1);
            for (const background of backgrounds) {
              const ratio = (Math.max(luminance(ink), luminance(background)) + 0.05)
                / (Math.min(luminance(ink), luminance(background)) + 0.05);
              expect(ratio).toBeGreaterThanOrEqual(4.5);
            }
          }
        } finally {
          shell.remove();
          style.remove();
          delete document.documentElement.dataset.theme;
        }
      });
    }
  }
});

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
