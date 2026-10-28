import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

test("all ingress loggers discard URI paths, queries and referrers", () => {
  const config = readFileSync(new URL("../Caddyfile", import.meta.url), "utf8");
  const filters = [...config.matchAll(/format filter \{([^}]+)\}/g)];
  assert.equal(filters.length, 3);
  for (const [, filter] of filters) {
    assert.match(filter, /request>uri delete/);
    assert.match(filter, /request>headers>Referer delete/);
  }
  assert.equal((config.match(/Referrer-Policy "no-referrer"/g) ?? []).length, 2);
});

test("pinned Caddy removes synthetic room paths from access and proxy-error logs", {
  skip: process.env.RUN_CADDY_RUNTIME_TESTS !== "1",
}, async () => {
  const compose = readFileSync(new URL("../docker-compose.yml", import.meta.url), "utf8");
  const image = compose.match(/image: (caddy:[^\s]+@sha256:[a-f0-9]+)/)?.[1];
  assert.ok(image, "runtime proof must use the exact pinned image");
  const name = `werewolf-caddy-privacy-test-${process.pid}`;
  const docker = (args, allowFailure = false) => {
    const result = spawnSync("docker", args, { encoding: "utf8", timeout: 20_000, windowsHide: true });
    if (!allowFailure) assert.equal(result.status, 0, result.stderr || result.error?.message);
    return `${result.stdout || ""}${result.stderr || ""}`;
  };
  try {
    docker(["run", "--detach", "--rm", "--pull=never", "--network=none", "--read-only", "--name", name,
      "--tmpfs", "/data", "--tmpfs", "/config",
      "--mount", `type=bind,source=${path.resolve("Caddyfile")},target=/etc/caddy/Caddyfile,readonly`,
      "--env", "PUBLIC_WEB_DOMAIN=http://localhost:8080",
      "--env", "PUBLIC_WS_DOMAIN=http://localhost:8081",
      "--env", "CORS_ORIGIN=http://localhost:8080", image]);
    const secret = "synthetic-private-token-4982";
    const code = "SYNTH42";
    const routes = [`/play/${code}`, `/lobby/${code}`, `/api/rooms/${code}/preview`,
      `/werewolf/join/${code}`, `/mafia/join/${code}`, `/rooms/${code}/preview`,
      "/play/%53YNTH42", "/api/auth/reset-password"];
    for (let attempt = 0; attempt < 30; attempt++) {
      if (docker(["logs", name]).includes("server running")) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    for (const port of [8080, 8081]) {
      for (const route of routes) {
        docker(["exec", name, "wget", "-qO-", "-T", "2", "--header", `Host: localhost:${port}`, "--header",
          `Referer: http://localhost/play/${code}?token=${secret}`,
          `http://127.0.0.1:${port}${route}?token=${secret}`], true);
      }
    }
    const logs = docker(["logs", name]);
    assert.doesNotMatch(logs, /SYNTH42|%53YNTH42|synthetic-private-token-4982/);
    const entries = logs.split(/\r?\n/).flatMap((line) => { try { return [JSON.parse(line)]; } catch { return []; } });
    for (const port of [8080, 8081]) {
      const requests = entries.filter((entry) => entry.request?.host === `localhost:${port}`);
      assert.ok(requests.some((entry) => entry.logger?.startsWith("http.log.access")), `access logger ${port}`);
      assert.ok(requests.some((entry) => entry.logger?.startsWith("http.log.error")), `proxy error logger ${port}`);
      for (const entry of requests) {
        assert.equal(entry.request.uri, undefined);
        assert.equal(entry.request.headers?.Referer, undefined);
      }
    }
  } finally {
    docker(["rm", "--force", name], true);
  }
});
