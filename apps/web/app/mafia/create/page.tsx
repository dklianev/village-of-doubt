import type { Metadata } from "next";
import { LobbyCreateClient } from "@/components/lobby-create-client";
import { requireSession } from "@/lib/require-session";

export const metadata: Metadata = {
  title: "Създай стая за Мафия | Върколак и Мафия",
  description: "Настрой частна маса за Мафия с твоя профил.",
};

export default async function MafiaCreatePage() {
  await requireSession("/mafia/create");

  return (
    <main className="shell lobby-shell" data-theme="mafia" data-family="mafia">
      <LobbyCreateClient initialMode="mafia_free" family="mafia" />
    </main>
  );
}
