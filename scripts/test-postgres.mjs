import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// A separate, uncached invocation keeps external database state out of Turbo's unit cache.
let valid = false;
try {
  const url = new URL(process.env.TEST_DATABASE_URL ?? "");
  valid = ["postgres:", "postgresql:"].includes(url.protocol)
    && /(?:^|[_-])test(?:$|[_-])/.test(decodeURIComponent(url.pathname.slice(1)));
} catch { /* Never print credentials from an invalid URL. */ }
if (!valid) {
  console.error("TEST_DATABASE_URL must name a dedicated migrated test database.");
  process.exitCode = 1;
} else {
  for (const [directory, file] of [
    ["packages/database", "src/queries.postgres.test.ts"],
    ["apps/game-server", "src/persistence/game-persistence.postgres.test.ts"],
  ]) {
    const require = createRequire(new URL(`../${directory}/package.json`, import.meta.url));
    const result = spawnSync(process.execPath, [
      join(dirname(require.resolve("vitest/package.json")), "vitest.mjs"), "run", file, "--maxWorkers=1",
    ], {
      cwd: fileURLToPath(new URL(`../${directory}/`, import.meta.url)),
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
      timeout: 120_000,
    });
    if (result.status !== 0) { process.exitCode = result.status ?? 1; break; }
  }
}
