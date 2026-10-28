import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Better Auth database schema", () => {
  it("accepts the Drizzle schema before any request reaches the database", async () => {
    // Nothing listens here: a schema mismatch is reported before Better Auth needs a connection.
    vi.stubEnv("DATABASE_URL", "postgres://synthetic:synthetic@127.0.0.1:9/synthetic");
    const { auth } = await import("../auth");

    await expect(auth.api.getSession({ headers: new Headers() })).resolves.toBeNull();
  });
});
