import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Next.js standalone output", () => {
  it("includes the ESM SWC helpers omitted by Next 16.3.1 tracing", () => {
    const configSource = readFileSync(resolve(process.cwd(), "next.config.ts"), "utf8");

    expect(configSource).toContain("outputFileTracingIncludes");
    expect(configSource).toContain("@swc+helpers@*/node_modules/@swc/helpers/esm/**/*");
  });

  it("does not expose the default Next.js powered-by header", () => {
    const configSource = readFileSync(resolve(process.cwd(), "next.config.ts"), "utf8");

    expect(configSource).toContain("poweredByHeader: false");
  });
});
