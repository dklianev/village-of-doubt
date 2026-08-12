import { createDatabase } from "@werewolf/database";
import { createHash } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { DEFAULT_AVATAR_ID, isAvatarId } from "@werewolf/shared";
import { normalizeExternalDisplayName, validateDisplayName } from "./display-name";
import { sendEmail } from "./email";
import { renderResetPasswordEmail, renderVerifyEmail } from "./email-templates";
import { createBetterAuthRateLimitStorage } from "./redis-rate-limit";
import { getRuntimeRateLimitBackend } from "./runtime-rate-limit";
import type { SharedRateLimitBackend } from "./rate-limit";
import { revokeActiveGameSessions } from "./game-session-revocation";

const databaseUrl = process.env.DATABASE_URL;
const db = databaseUrl ? createDatabase(databaseUrl) : undefined;
const DEVELOPMENT_AUTH_SECRET = "dev-only-secret-replace-before-production-32-chars";
const PLACEHOLDER_SECRET_PATTERN = /dev-only|replace|change-me|placeholder/i;
export const ACCOUNT_DELETE_FRESH_AGE_SECONDS = 10 * 60;
export const AUTH_RATE_LIMIT_RULES = {
  // These are shared-IP guards. Account-specific abuse is limited separately
  // so a full table behind one home, school, or venue NAT can still sign in.
  "/sign-in/email": { window: 60, max: 60 },
  "/sign-up/email": { window: 60 * 60, max: 60 },
  "/sign-in/social": { window: 60, max: 60 },
  "/callback/*": { window: 60, max: 30 },
  "/request-password-reset": { window: 60 * 60, max: 60 },
  "/send-verification-email": { window: 60 * 60, max: 60 },
  "/reset-password": { window: 5 * 60, max: 30 },
} as const;

const AUTH_IDENTIFIER_RATE_LIMIT_RULES = {
  "/sign-in/email": { windowMs: 60_000, limit: 10 },
  "/sign-up/email": { windowMs: 3_600_000, limit: 5 },
  "/request-password-reset": { windowMs: 3_600_000, limit: 5 },
  "/send-verification-email": { windowMs: 3_600_000, limit: 5 },
} as const;
const authIdentifierRateLimitBackend = getRuntimeRateLimitBackend("auth-identity");

type AuthSecretEnvironment = {
  NODE_ENV?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_SECRETS?: string;
  BETTER_AUTH_LEGACY_TOKENS_RETIRED?: string;
};

type AuthIdentifierRateLimitInput = {
  path: string;
  body: unknown;
  backend?: SharedRateLimitBackend;
  nodeEnv?: string;
  now?: number;
};

export async function enforceAuthIdentifierRateLimit({
  path,
  body,
  backend = authIdentifierRateLimitBackend,
  nodeEnv = process.env.NODE_ENV,
  now = Date.now(),
}: AuthIdentifierRateLimitInput) {
  if (nodeEnv !== "production" || !(path in AUTH_IDENTIFIER_RATE_LIMIT_RULES)) {
    return;
  }

  const email = isRecord(body) && typeof body.email === "string"
    ? body.email.trim().toLocaleLowerCase("en-US")
    : "";
  if (!email) {
    return;
  }

  const rule = AUTH_IDENTIFIER_RATE_LIMIT_RULES[path as keyof typeof AUTH_IDENTIFIER_RATE_LIMIT_RULES];
  const identifier = createHash("sha256").update(email).digest("hex");
  const result = await backend.consume({
    key: `${path}:${identifier}`,
    limit: rule.limit,
    windowMs: rule.windowMs,
    now,
  });
  if (!result.allowed) {
    throw new APIError("TOO_MANY_REQUESTS", {
      message: "Твърде много опити. Опитай отново по-късно.",
    });
  }
}

export function resolveBetterAuthSecret(
  environment: AuthSecretEnvironment = process.env,
): string | undefined {
  const secret = environment.BETTER_AUTH_SECRET?.trim();

  if (environment.NODE_ENV === "production") {
    if (secret && (secret.length < 32 || PLACEHOLDER_SECRET_PATTERN.test(secret))) {
      throw new Error("BETTER_AUTH_SECRET must be a non-placeholder secret with at least 32 characters in production.");
    }
    if (!secret) {
      if (!environment.BETTER_AUTH_SECRETS?.trim()) {
        throw new Error("BETTER_AUTH_SECRETS is required when BETTER_AUTH_SECRET is retired.");
      }
      if (environment.BETTER_AUTH_LEGACY_TOKENS_RETIRED !== "true") {
        throw new Error(
          "BETTER_AUTH_LEGACY_TOKENS_RETIRED=true is required before BETTER_AUTH_SECRET can be retired.",
        );
      }
      return undefined;
    }
  }

  return secret || DEVELOPMENT_AUTH_SECRET;
}

const authSecret = resolveBetterAuthSecret();
export const auth = betterAuth({
  ...(authSecret ? { secret: authSecret } : {}),
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  trustedOrigins: buildTrustedOrigins(),
  database: db
    ? drizzleAdapter(db, {
        provider: "pg",
      })
    : undefined,
  rateLimit: {
    enabled: process.env.NODE_ENV === "production",
    window: 60,
    max: 100,
    storage: "memory",
    ...(process.env.REDIS_URL
      ? { customStorage: createBetterAuthRateLimitStorage(getRuntimeRateLimitBackend("auth")) }
      : {}),
    customRules: AUTH_RATE_LIMIT_RULES,
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    autoSignIn: true,
    resetPasswordTokenExpiresIn: 3600,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      const template = renderResetPasswordEmail({
        brandUrl: process.env.BETTER_AUTH_URL ?? "",
        resetUrl: url,
        displayName: user.name || "приятел",
      });

      await sendEmail({ to: user.email, ...template });
    },
    onPasswordReset: async ({ user }) => {
      await revokeActiveGameSessions(user.id);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => {
      const template = renderVerifyEmail({
        brandUrl: process.env.BETTER_AUTH_URL ?? "",
        verifyUrl: url,
        displayName: user.name || "приятел",
      });

      await sendEmail({ to: user.email, ...template });
    },
  },
  session: {
    freshAge: ACCOUNT_DELETE_FRESH_AGE_SECONDS,
  },
  account: {
    encryptOAuthTokens: true,
  },
  databaseHooks: {
    user: {
      create: {
        before: async (newUser) => ({
          data: {
            ...newUser,
            name: normalizeExternalDisplayName(newUser.name),
          },
        }),
      },
    },
  },
  user: {
    additionalFields: {
      avatarId: {
        type: "string",
        required: true,
        defaultValue: DEFAULT_AVATAR_ID,
        input: true,
      },
    },
    deleteUser: {
      // The app route performs auth cleanup and history anonymization in one DB transaction.
      enabled: false,
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      await enforceAuthIdentifierRateLimit({
        path: ctx.path,
        body: ctx.body,
      });

      if (!["/sign-up/email", "/update-user"].includes(ctx.path) || !ctx.body) {
        return;
      }

      const body = ctx.body as Record<string, unknown>;
      const nextBody = { ...body };

      if (Object.hasOwn(body, "name")) {
        const result = validateDisplayName(body.name);
        if (!result.ok) {
          throw new APIError("BAD_REQUEST", { message: result.error });
        }
        nextBody.name = result.displayName;
      }

      if (Object.hasOwn(body, "avatarId") && !isAvatarId(body.avatarId)) {
        throw new APIError("BAD_REQUEST", { message: "Избраният портрет не е наличен." });
      }

      return {
        context: {
          ...ctx,
          body: {
            ...nextBody,
          },
        },
      };
    }),
  },
  socialProviders: buildSocialProviders(),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function buildSocialProviders() {
  const providers: Record<string, { clientId: string; clientSecret: string }> = {};

  if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
    providers.discord = {
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
    };
  }

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.google = {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    };
  }

  return Object.keys(providers).length > 0 ? providers : undefined;
}

export function buildTrustedOrigins(
  environment: Partial<Pick<NodeJS.ProcessEnv, "NODE_ENV" | "BETTER_AUTH_URL" | "NEXT_PUBLIC_APP_URL">> = process.env,
) {
  const origins = [
    environment.BETTER_AUTH_URL,
    environment.NEXT_PUBLIC_APP_URL,
    ...(environment.NODE_ENV === "production"
      ? []
      : ["http://localhost:3000", "http://127.0.0.1:3000"]),
  ].filter((origin): origin is string => Boolean(origin));

  return [...new Set(origins)];
}
