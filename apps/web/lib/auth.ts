import { createDatabase } from "@werewolf/database";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

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
    minPasswordLength: 8,
    autoSignIn: true,
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
