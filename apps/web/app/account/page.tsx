import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AccountClient } from "@/components/account/AccountClient";
import { ResourceHints } from "@/components/resource-hints";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Твоето досие | Върколак и Мафия",
  description: "Профил, име, парола и контрол на твоите данни.",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session) {
    redirect("/sign-in?redirect=/account");
  }

  const accounts = await auth.api.listUserAccounts({ headers: requestHeaders }).catch(() => []);
  const providerIds = new Set(accounts.map((account) => account.providerId));
  if (session.user.email) {
    providerIds.add("credential");
  }

  return (
    <main className="shell dossier-shell">
      <ResourceHints images={["/game-art/auth/account-dossier.webp"]} />
      <AccountClient
        userId={session.user.id}
        email={session.user.email}
        name={session.user.name ?? ""}
        image={session.user.image ?? null}
        emailVerified={session.user.emailVerified ?? false}
        providers={[...providerIds]}
      />
    </main>
  );
}
