import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export async function requireSession(redirectTo: string) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect(`/sign-in?redirect=${encodeURIComponent(redirectTo)}`);
  }

  return session;
}
