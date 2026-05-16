import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";

const deleteUser = vi.fn(() => Promise.resolve());
const anonymizeUserGameHistory = vi.fn(() => Promise.resolve());

vi.mock("next/headers", () => ({
  headers: vi.fn(() => Promise.resolve(new Headers())),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      deleteUser,
    },
  },
}));

vi.mock("@werewolf/database", () => ({
  anonymizeUserGameHistory,
  createDatabase: vi.fn(() => ({ mocked: true })),
}));

describe("POST /api/account/delete", () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    vi.clearAllMocks();
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
  });

  it("отказва гости", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);

    const response = await POST();

    expect(response.status).toBe(401);
  });

  it("анонимизира историята преди да изтрие профила", async () => {
    process.env.DATABASE_URL = "postgres://postgres:postgres@localhost:5432/werewolf";
    const { auth } = await import("@/lib/auth");
    const { anonymizeUserGameHistory: anonymize, createDatabase } = await import("@werewolf/database");
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "user-1" } } as never);

    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(createDatabase).toHaveBeenCalledWith(process.env.DATABASE_URL);
    expect(anonymize).toHaveBeenCalledWith({ mocked: true }, "user-1");
    expect(deleteUser).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: { userId: "user-1", callbackURL: "/" },
    });
    const anonymizeOrder = vi.mocked(anonymize).mock.invocationCallOrder[0];
    const deleteOrder = deleteUser.mock.invocationCallOrder[0];
    expect(anonymizeOrder).toBeDefined();
    expect(deleteOrder).toBeDefined();
    expect(anonymizeOrder!).toBeLessThan(deleteOrder!);
  });

  it("връща грешка, ако анонимизирането се провали", async () => {
    process.env.DATABASE_URL = "postgres://postgres:postgres@localhost:5432/werewolf";
    const { auth } = await import("@/lib/auth");
    const { anonymizeUserGameHistory: anonymize } = await import("@werewolf/database");
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(anonymize).mockRejectedValueOnce(new Error("db failed"));

    const response = await POST();

    expect(response.status).toBe(500);
    expect(deleteUser).not.toHaveBeenCalled();
  });
});
