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

  it("keeps static-shell validation enabled for the application", () => {
    expect(layoutSource).not.toContain("export const instant = false;");
  });
});
