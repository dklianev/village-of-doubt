import type { Metadata } from "next";
import { LobbyCreateClient } from "@/components/lobby-create-client";
import { requireSession } from "@/lib/require-session";

export const metadata: Metadata = {
  title: "Създай стая за Върколак",
  description: "Настрой частно село за Върколак с твоето досие.",
};

export default async function WerewolfCreatePage({
  searchParams,
}: {
  searchParams?: Promise<{ visualAuth?: string | string[] }>;
}) {
  const visualAuth = firstSearchValue((await searchParams)?.visualAuth);
  if (process.env.NODE_ENV === "production" || visualAuth !== "1") {
    await requireSession("/werewolf/create");
  }

  return (
    <main className="shell lobby-shell" data-faction="werewolves" data-family="werewolves">
      <LobbyCreateClient initialMode="werewolves_classic" family="werewolves" />
    </main>
  );
}

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
