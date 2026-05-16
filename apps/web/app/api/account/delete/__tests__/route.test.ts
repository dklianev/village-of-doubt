import { describe, expect, it, vi } from "vitest";
import { POST } from "../route";

const deleteUser = vi.fn(() => Promise.resolve());

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

describe("POST /api/account/delete", () => {
  it("rejects guests", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);

    const response = await POST();

    expect(response.status).toBe(401);
  });

  it("deletes the authenticated account through Better Auth", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "user-1" } } as never);

    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect(deleteUser).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: { callbackURL: "/" },
    });
  });
});
