import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const layoutSource = readFileSync(resolve(process.cwd(), "app/layout.tsx"), "utf8");

describe("root layout cacheability", () => {
  it("does not read request-bound auth state for the shared public shell", () => {
    expect(layoutSource).not.toContain("getRequestSession");
    expect(layoutSource).not.toContain("toAuthSessionView");
    expect(layoutSource).toContain("<SiteChrome />");
  });

  it("streams route-aware chrome inside a stable modal isolation boundary", () => {
    expect(layoutSource).toContain("function SiteChromeFallback()");
    expect(layoutSource).toContain('<header className="site-chrome" data-version="v2"');
    expect(layoutSource).toContain('<div className="site-chrome-boundary" suppressHydrationWarning>');
    expect(layoutSource).toContain("<Suspense fallback={<SiteChromeFallback />}>");
    expect(layoutSource).toMatch(
      /<div className="site-chrome-boundary" suppressHydrationWarning>\s*<Suspense fallback={<SiteChromeFallback \/>}>\s*<SiteChrome \/>\s*<\/Suspense>\s*<\/div>/,
    );
  });

  it("keeps static-shell validation enabled for the application", () => {
    expect(layoutSource).not.toContain("export const instant = false;");
  });
});
