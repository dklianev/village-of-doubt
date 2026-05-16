import { createAuthClient } from "better-auth/react";
import { env } from "./env";

export const authClient = createAuthClient({
  baseURL: typeof window === "undefined" ? env.NEXT_PUBLIC_APP_URL : window.location.origin,
});
