import { createDatabase } from "@werewolf/database";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { sendEmail } from "./email";
import { renderResetPasswordEmail, renderVerifyEmail } from "./email-templates";

const databaseUrl = process.env.DATABASE_URL;
const db = databaseUrl ? createDatabase(databaseUrl) : undefined;

export const auth = betterAuth({
  // Docker/production must provide real values; these fallbacks keep local builds deterministic.
  secret: process.env.BETTER_AUTH_SECRET ?? "dev-only-secret-replace-before-production-32-chars",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  trustedOrigins: buildTrustedOrigins(),
  database: db
    ? drizzleAdapter(db, {
        provider: "pg",
      })
    : undefined,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    autoSignIn: true,
    resetPasswordTokenExpiresIn: 3600,
    sendResetPassword: async ({ user, url }) => {
      const template = renderResetPasswordEmail({
        brandUrl: process.env.BETTER_AUTH_URL ?? "",
        resetUrl: url,
        displayName: user.name || "приятел",
      });

      await sendEmail({ to: user.email, ...template });
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
  user: {
    deleteUser: {
      enabled: true,
    },
  },
  socialProviders: buildSocialProviders(),
});

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

function buildTrustedOrigins() {
  return [
    process.env.BETTER_AUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ].filter((origin): origin is string => Boolean(origin));
}
