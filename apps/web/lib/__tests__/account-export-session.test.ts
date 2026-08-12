import { describe, expect, it } from "vitest";
import {
  createAccountExportContinuation,
  verifyAccountExportContinuation,
} from "../account-export-session";

const SECRET = "test-export-secret-with-at-least-32-characters";

describe("account export continuation", () => {
  it("е обвързан с потребителя и срока си", () => {
    const token = createAccountExportContinuation("user-1", SECRET, {
      nowSeconds: 1_000,
      ttlSeconds: 60,
      exportId: "export-1",
    });

    expect(verifyAccountExportContinuation(token, "user-1", SECRET, 1_059)).toEqual({
      exportId: "export-1",
      expiresAt: 1_060,
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
