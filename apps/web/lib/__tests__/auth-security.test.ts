import { beforeEach, describe, expect, it, vi } from "vitest";

const { APIError, betterAuth, createAuthMiddleware, createDatabase } = vi.hoisted(() => {
  class MockAPIError extends Error {
    constructor(
      public status: string,
      options: { message: string },
    ) {
      super(options.message);
    }
  }

  return {
    APIError: MockAPIError,
    betterAuth: vi.fn((options: unknown) => ({ api: {}, options })),
    createAuthMiddleware: vi.fn((handler: unknown) => handler),
    createDatabase: vi.fn(() => ({ mockedDatabase: true })),
  };
});

vi.mock("@werewolf/database", () => ({
  createDatabase,
}));

vi.mock("better-auth", () => ({ betterAuth }));
vi.mock("better-auth/adapters/drizzle", () => ({ drizzleAdapter: vi.fn(() => ({ mockedAdapter: true })) }));
vi.mock("better-auth/api", () => ({ APIError, createAuthMiddleware }));
vi.mock("../email", () => ({ sendEmail: vi.fn() }));
vi.mock("../email-templates", () => ({
  renderResetPasswordEmail: vi.fn(),
  renderVerifyEmail: vi.fn(),
}));

describe("Better Auth security configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ["липсваща", undefined],
    ["къса", "too-short"],
    ["placeholder", "dev-only-replace-this-placeholder-secret-123456"],
  ])("отхвърля %s production тайна", async (_label, secret) => {
    const { resolveBetterAuthSecret } = await import("../auth");
    const environment = secret
      ? { NODE_ENV: "production", BETTER_AUTH_SECRET: secret }
      : { NODE_ENV: "production" };

    expect(() => resolveBetterAuthSecret(environment)).toThrow("BETTER_AUTH_SECRET");
  }, 10_000);

  it("приема силна production тайна и пази fallback-а само за non-production", async () => {
    const { resolveBetterAuthSecret } = await import("../auth");
    const productionSecret = "a-strong-production-secret-with-40-characters";

    expect(resolveBetterAuthSecret({ NODE_ENV: "production", BETTER_AUTH_SECRET: productionSecret })).toBe(
      productionSecret,
    );
    expect(resolveBetterAuthSecret({ NODE_ENV: "test" })).toContain("dev-only");
  });

  it("позволява legacy тайната да се оттегли само след versioned migration sign-off", async () => {
    const { resolveBetterAuthSecret } = await import("../auth");
    const versionedEnvironment = {
      NODE_ENV: "production",
      BETTER_AUTH_SECRETS: "2:a-current-versioned-secret-with-enough-entropy",
    };

    expect(() => resolveBetterAuthSecret(versionedEnvironment)).toThrow(
      "BETTER_AUTH_LEGACY_TOKENS_RETIRED",
    );
    expect(resolveBetterAuthSecret({
      ...versionedEnvironment,
      BETTER_AUTH_LEGACY_TOKENS_RETIRED: "true",
    })).toBeUndefined();
  });

  it("не допуска localhost сред trusted origins в production", async () => {
    const { buildTrustedOrigins } = await import("../auth");

    expect(buildTrustedOrigins({
      NODE_ENV: "production",
      BETTER_AUTH_URL: "https://werewolf.example.com",
      NEXT_PUBLIC_APP_URL: "https://werewolf.example.com",
    })).toEqual(["https://werewolf.example.com"]);
    expect(buildTrustedOrigins({
      NODE_ENV: "development",
      BETTER_AUTH_URL: "http://localhost:3000",
    })).toEqual([
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]);
  });

  it("изключва неатомичния Better Auth delete endpoint и изисква freshness до 10 минути", async () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgres://postgres:postgres@localhost:5432/werewolf";
    vi.resetModules();

    try {
      await import("../auth");
      const options = betterAuth.mock.calls.at(-1)?.[0] as {
        session: { freshAge: number };
        user: { deleteUser: { enabled: boolean } };
      };
      expect(createDatabase).toHaveBeenCalledWith(process.env.DATABASE_URL);
      expect(options.user.deleteUser.enabled).toBe(false);
      expect(options.session.freshAge).toBe(10 * 60);
    } finally {
      if (previousDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = previousDatabaseUrl;
      }
      vi.resetModules();
    }
  });

  it("задава тесни production лимити на чувствителните auth endpoints", async () => {
    vi.resetModules();
    await import("../auth");
    const options = betterAuth.mock.calls.at(-1)?.[0] as {
      rateLimit: {
        enabled: boolean;
        window: number;
        max: number;
        storage: string;
        customRules: Record<string, { window: number; max: number }>;
      };
    };

    expect(options.rateLimit).toMatchObject({
      enabled: false,
      window: 60,
      max: 100,
      storage: "memory",
    });
    expect(options.rateLimit.customRules).toMatchObject({
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 3_600, max: 5 },
      "/request-password-reset": { window: 3_600, max: 5 },
      "/send-verification-email": { window: 3_600, max: 5 },
      "/reset-password": { window: 300, max: 10 },
    });
  });

  it("криптира OAuth токените преди запис в базата", async () => {
    vi.resetModules();
    await import("../auth");
    const options = betterAuth.mock.calls.at(-1)?.[0] as {
      account?: { encryptOAuthTokens?: boolean };
    };

    expect(options.account?.encryptOAuthTokens).toBe(true);
  });

  it("прекратява старите сесии след успешна смяна на парола", async () => {
    vi.resetModules();
    await import("../auth");
    const options = betterAuth.mock.calls.at(-1)?.[0] as {
      emailAndPassword?: { revokeSessionsOnPasswordReset?: boolean };
    };

    expect(options.emailAndPassword?.revokeSessionsOnPasswordReset).toBe(true);
  });

  it.each(["/sign-up/email", "/update-user"])(
    "отхвърля име над 32 символа за %s с безопасна българска грешка",
    async (path) => {
    const beforeHook = await loadBeforeHook();

    await expect(
      beforeHook({
        path,
        body: { name: "А".repeat(33) },
      }),
    ).rejects.toMatchObject({
      status: "BAD_REQUEST",
      message: "Името трябва да е най-много 32 символа.",
    });
    },
  );

  it.each(["/sign-up/email", "/update-user"])(
    "нормализира валидното име за %s преди запис",
    async (path) => {
    const beforeHook = await loadBeforeHook();

    await expect(
      beforeHook({
        path,
        body: { name: "  Анна   Мария  ", image: "avatar.png" },
      }),
    ).resolves.toMatchObject({
      context: {
        body: { name: "Анна Мария", image: "avatar.png" },
      },
    });
    },
  );

  it.each(["/sign-up/email", "/update-user"])(
    "отхвърля avatarId извън подбрания каталог за %s",
    async (path) => {
    const beforeHook = await loadBeforeHook();

    await expect(
      beforeHook({
        path,
        body: { avatarId: "https://example.com/avatar.png" },
      }),
    ).rejects.toMatchObject({
      status: "BAD_REQUEST",
      message: "Избраният портрет не е наличен.",
    });
    },
  );

  it.each([
    ["control", "Анна\nМария"],
    ["bidi", "Анна\u202eМария"],
  ])("отхвърля %s символи при signup и update-user", async (_label, name) => {
    const beforeHook = await loadBeforeHook();

    for (const path of ["/sign-up/email", "/update-user"]) {
      await expect(beforeHook({ path, body: { name } })).rejects.toMatchObject({
        status: "BAD_REQUEST",
        message: "Името съдържа непозволени невидими знаци.",
      });
    }
  });

  it("sanitizes OAuth-created names without blocking provider login", async () => {
    const beforeCreate = await loadUserCreateBeforeHook();

    await expect(beforeCreate(
      { id: "oauth-1", email: "oauth@example.com", name: "  А\u202eнна\nМария  " },
      { path: "/callback/google" },
    )).resolves.toMatchObject({ data: { name: "Анна Мария" } });
    await expect(beforeCreate(
      { id: "oauth-2", email: "oauth2@example.com", name: "\u202e\u0000" },
      { path: "/callback/discord" },
    )).resolves.toMatchObject({ data: { name: "Играч" } });
  });

  it("scrub-ва control/bidi символи и от legacy game-token display names", async () => {
    const { normalizeGameTokenDisplayName } = await import("../display-name");

    expect(normalizeGameTokenDisplayName("А\u202eнна\nМария")).toBe("Анна Мария");
  });
});

async function loadBeforeHook() {
  vi.resetModules();
  await import("../auth");
  const options = betterAuth.mock.calls.at(-1)?.[0] as {
    hooks: {
      before: (context: { path: string; body?: Record<string, unknown> }) => Promise<unknown>;
    };
  };

  return options.hooks.before;
}

async function loadUserCreateBeforeHook() {
  vi.resetModules();
  await import("../auth");
  const options = betterAuth.mock.calls.at(-1)?.[0] as {
    databaseHooks: {
      user: {
        create: {
          before: (
            user: Record<string, unknown>,
            context: { path: string } | null,
          ) => Promise<unknown>;
        };
      };
    };
  };

  return options.databaseHooks.user.create.before;
}
