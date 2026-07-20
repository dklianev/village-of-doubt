import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import type { AuthSessionView } from "@/lib/use-auth-session";

export const getRequestSession = cache(async () => auth.api.getSession({ headers: await headers() }));

export function toAuthSessionView(
  session: Awaited<ReturnType<typeof getRequestSession>>,
): AuthSessionView | null {
  if (!session?.user?.id) {
    return null;
  }

  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image ?? null,
      avatarId: session.user.avatarId,
    },
  };
}
