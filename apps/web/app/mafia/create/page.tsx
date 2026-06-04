import type { Metadata } from "next";
import { LobbyCreateClient } from "@/components/lobby-create-client";
import { requireSession } from "@/lib/require-session";

export const metadata: Metadata = {
  title: "Създай стая за Мафия",
  description: "Настрой частна маса за Мафия с твоето досие.",
};

export default async function MafiaCreatePage({
  searchParams,
}: {
  searchParams?: Promise<{ visualAuth?: string | string[] }>;
}) {
  const visualAuth = firstSearchValue((await searchParams)?.visualAuth);
  if (process.env.NODE_ENV === "production" || visualAuth !== "1") {
    await requireSession("/mafia/create");
  }

  return (
    <main className="shell lobby-shell" data-faction="mafia" data-family="mafia">
      <LobbyCreateClient initialMode="mafia_free" family="mafia" />
    </main>
  );
}

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
