import type { Metadata } from "next";
import { LobbyCreateClient } from "@/components/lobby-create-client";
import { requireSession } from "@/lib/require-session";

export const metadata: Metadata = {
  title: "Създай стая за Върколак | Върколак и Мафия",
  description: "Настрой частно село за Върколак с твоя профил.",
};

export default async function WerewolfCreatePage() {
  await requireSession("/werewolf/create");

  return (
    <main className="shell lobby-shell" data-theme="werewolves" data-family="werewolves">
      <LobbyCreateClient initialMode="werewolves_classic" family="werewolves" />
    </main>
  );
}
