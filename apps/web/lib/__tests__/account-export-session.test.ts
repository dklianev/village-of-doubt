import { describe, expect, it } from "vitest";
import {
  createAccountExportContinuation,
  verifyAccountExportContinuation,
} from "../account-export-session";

const SECRET = "test-export-secret-with-at-least-32-characters";

describe("account export continuation", () => {
  it("preserves a bounded batch without extending the session deadline", () => {
    const batch = { gameIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"], gameCursor: null, pageSize: 100 };
    const token = createAccountExportContinuation("user", SECRET, { nowSeconds: 1000, expiresAt: 1200, snapshotAt: "1970-01-01T00:16:40.000Z", batch });
    expect(verifyAccountExportContinuation(token, "user", SECRET, 1100)).toMatchObject({ batch, expiresAt: 1200, snapshotAt: "1970-01-01T00:16:40.000Z" });
    const invalid = createAccountExportContinuation("user", SECRET, { batch: { ...batch, gameIds: ["not-a-uuid"] } });
    expect(verifyAccountExportContinuation(invalid, "user", SECRET)).toBeNull();
  });

  it("е обвързан с потребителя и срока си", () => {
    const token = createAccountExportContinuation("user-1", SECRET, {
      nowSeconds: 1_000,
      ttlSeconds: 60,
      exportId: "export-1",
    });

    expect(verifyAccountExportContinuation(token, "user-1", SECRET, 1_059)).toEqual({
      exportId: "export-1",
      expiresAt: 1_060,
      snapshotAt: "1970-01-01T00:16:40.000Z",
    });
    expect(verifyAccountExportContinuation(token, "user-2", SECRET, 1_059)).toBeNull();
    expect(verifyAccountExportContinuation(token, "user-1", SECRET, 1_061)).toBeNull();
  });

  it("отказва подправен payload и подпис", () => {
    const token = createAccountExportContinuation("user-1", SECRET, {
      nowSeconds: 1_000,
      ttlSeconds: 60,
      exportId: "export-1",
    });
    const [payload, signature] = token.split(".");

    expect(verifyAccountExportContinuation(`${payload}x.${signature}`, "user-1", SECRET, 1_001)).toBeNull();
    expect(verifyAccountExportContinuation(`${payload}.${signature}x`, "user-1", SECRET, 1_001)).toBeNull();
  });
});
