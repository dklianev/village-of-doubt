import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../route";

describe("GET /api/health", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("остава shallow liveness probe и публикува безопасни release метаданни", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RELEASE_VERSION", "2026.07.19.1");

    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: "werewolf-web",
      kind: "liveness",
      environment: "production",
      release: "2026.07.19.1",
    });
  });
});
