import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function mediaBlocks(css: string, query: string) {
  const blocks: string[] = [];
  for (let start = css.indexOf(`@media ${query} {`); start !== -1; start = css.indexOf(`@media ${query} {`, start + 1)) {
    let depth = 0;
    for (let index = css.indexOf("{", start); index < css.length; index += 1) {
      if (css[index] === "{") depth += 1;
      if (css[index] === "}" && --depth === 0) {
        blocks.push(css.slice(start, index));
        break;
      }
    }
  }
  return blocks.join("\n");
}

describe("mobile table navigation", () => {
  it("stays sticky below 1024 px because the framed room shell clips without becoming a scroll container", () => {
    const css = readFileSync(resolve(process.cwd(), "components/play/PlayRoom.module.css"), "utf8");
    const belowDesktop = mediaBlocks(css, "(max-width: 1023px)");

    expect(belowDesktop).toMatch(/:global\(\.play-mobile-navigation\) \{[^}]*position: sticky/);
    // `.framed-shell` sets overflow: hidden, which traps sticky descendants inside a non-scrolling box.
    expect(belowDesktop).toMatch(/:global\(\.play-shell\.framed-shell\) \{[^}]*overflow: clip/);
  });
});
