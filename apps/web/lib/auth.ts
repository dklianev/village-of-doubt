import { createDatabase } from "@werewolf/database";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

const databaseUrl = process.env.DATABASE_URL;
const db = databaseUrl ? createDatabase(databaseUrl) : undefined;

export const auth = betterAuth({
  // Docker/production must provide real values; these fallbacks keep local builds deterministic.
  secret: process.env.BETTER_AUTH_SECRET ?? "dev-only-secret-replace-before-production-32-chars",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
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
  socialProviders:
    process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET
      ? {
          discord: {
            clientId: process.env.DISCORD_CLIENT_ID,
            clientSecret: process.env.DISCORD_CLIENT_SECRET,
          },
        }
      : undefined,
});
