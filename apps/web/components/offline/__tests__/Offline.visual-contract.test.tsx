import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "components/offline/Offline.module.css"), "utf8");

describe("offline visual contract", () => {
  it("keeps hero copy readable over the image in the light theme", () => {
    const lightThemeBlock = css.match(
      /:global\(html\[data-theme="light"\] \.offline-shell\)\s*\{([^}]*)\}/,
    )?.[1];

    expect(lightThemeBlock).toBeDefined();
    expect(lightThemeBlock).toContain("--offline-text-muted: rgba(245, 232, 200");
  });

  it("keeps the retry control at a full touch target", () => {
    expect(css).toMatch(/\.offline-status-retry\)[\s\S]*width:\s*44px;[\s\S]*height:\s*44px;/);
  });
});
