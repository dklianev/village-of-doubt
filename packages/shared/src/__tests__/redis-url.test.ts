import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveRedisUrl } from "../server.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, {
    force: true,
    recursive: true,
  })));
});

describe("resolveRedisUrl", () => {
  it("injects the Docker secret without exposing it through a separate environment value", async () => {
    const directory = await mkdtemp(join(tmpdir(), "werewolf-redis-secret-"));
    temporaryDirectories.push(directory);
    const secretFile = join(directory, "password");
    await writeFile(secretFile, "redis-password-with-32-safe-characters", "utf8");

    const resolved = new URL(resolveRedisUrl("redis://redis:6379", secretFile));

    expect(resolved.username).toBe("default");
    expect(resolved.password).toBe("redis-password-with-32-safe-characters");
    expect(resolved.hostname).toBe("redis");
  });

  it("keeps a managed authenticated Redis URL when no secret file is configured", () => {
    const url = "rediss://service:managed-secret@redis.example.com:6380";

    expect(resolveRedisUrl(url)).toBe(url);
  });

  it("rejects an empty Redis secret file", async () => {
    const directory = await mkdtemp(join(tmpdir(), "werewolf-redis-secret-"));
    temporaryDirectories.push(directory);
    const secretFile = join(directory, "password");
    await writeFile(secretFile, "\n", "utf8");

    expect(() => resolveRedisUrl("redis://redis:6379", secretFile)).toThrow("Redis тайната е празна");
  });
});
