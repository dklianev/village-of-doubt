import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("game server database lifecycle", () => {
  it("closes shared database pools during graceful shutdown", () => {
    const source = readFileSync(resolve(process.cwd(), "src/index.ts"), "utf8");

    expect(source).toContain('import { closeAllDatabases } from "@werewolf/database"');
    expect(source).toContain("await closeAllDatabases()");
  });

  it("composes Redis and database cleanup in the entrypoint shutdown handler", () => {
    const indexSource = readFileSync(resolve(process.cwd(), "src/index.ts"), "utf8");
    const appConfigSource = readFileSync(resolve(process.cwd(), "src/app.config.ts"), "utf8");

    expect(indexSource).toContain("closeGameServerRedisRuntime");
    expect(indexSource).toContain("await closeGameServerRedisRuntime()");
    expect(appConfigSource).not.toContain("gameServer.onShutdown");
  });
});
