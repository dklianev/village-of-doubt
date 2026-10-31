import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

function focusRule(css: string, selector: string) {
  const start = css.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("}", start));
}

describe("custom focus rings in forced-colors mode", () => {
  it.each([
    ["components/site-chrome/SiteChrome.module.css", ":global(.auth-chip:focus-visible)"],
    ["components/site-chrome/SiteChrome.module.css", ":global(.auth-chip-trigger:focus-visible)"],
    ["components/feedback/FeedbackWidget.module.css", ".fab:focus-visible"],
  ])("%s %s keeps an outline that forced colors can repaint", (path, selector) => {
    const rule = focusRule(read(path), selector);

    // Forced colors remove box-shadow; a transparent outline is repainted with the system colour.
    expect(rule).toMatch(/outline:\s*2px solid transparent/);
    expect(rule).not.toMatch(/outline:\s*none/);
  });
});
