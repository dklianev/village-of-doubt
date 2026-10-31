import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("./frontend-e2e-matrix.mjs", import.meta.url), "utf8");

async function runMatrix(env) {
  const resets = [];
  const children = [];
  const context = vm.createContext({
    process: { cwd: () => process.cwd(), env, execPath: process.execPath },
    URL,
    console: { log() {} },
  });
  const modules = {
    "node:path": { join: path.join },
    "node:module": { createRequire: () => () => ({
      createClient: ({ url }) => ({
        isOpen: true,
        async connect() {},
        async flushDb() { resets.push(url); },
        async quit() {},
      }),
    }) },
    "node:child_process": { spawn: (_command, _args, options) => {
      children.push(options.env);
      const child = new EventEmitter();
      queueMicrotask(() => child.emit("exit", 0, null));
      return child;
    } },
  };
  const module = new vm.SourceTextModule(source, { context });
  await module.link((specifier) => {
    const values = modules[specifier];
    assert.ok(values, `Unexpected import: ${specifier}`);
    return new vm.SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  return { resets, children };
}

for (const env of [
  { REDIS_URL: "redis://127.0.0.1:6379/2" },
  { FRONTEND_E2E_REDIS_URL: "redis://127.0.0.1:6379/3" },
  { REDIS_URL: "redis://127.0.0.1:6379/2", FRONTEND_E2E_REDIS_URL: "rediss://localhost:6380/4" },
]) {
  test(`child effective Redis targets equal reset targets: ${Object.keys(env).join(", ")}`, async () => {
    const { resets, children } = await runMatrix(env);
    assert.deepEqual(resets.map((value) => new URL(value).pathname), ["/12", "/13", "/14"]);
    assert.deepEqual(children.map((child) => child.FRONTEND_E2E_REDIS_URL), resets);
    assert.deepEqual(children.map((child) => child.REDIS_URL), resets);
    assert.deepEqual(children.map((child) => child.FRONTEND_E2E_BROWSER), ["chromium", "firefox", "webkit"]);
    assert.deepEqual(children.map((child) => child.FRONTEND_E2E_SKIP_BUILD), ["false", "true", "true"]);
  });
}

test("refuses non-local Redis before resetting a database", async () => {
  await assert.rejects(runMatrix({ FRONTEND_E2E_REDIS_URL: "redis://remote.invalid/2" }), /refuses non-local/);
});
