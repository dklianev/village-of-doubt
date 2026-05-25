import type { Metadata } from "next";
import { LobbyCreateClient } from "@/components/lobby-create-client";
import { requireSession } from "@/lib/require-session";

export const metadata: Metadata = {
  title: "Създай стая за Мафия",
  description: "Настрой частна маса за Мафия с твоето досие.",
};

export default async function MafiaCreatePage() {
  await requireSession("/mafia/create");

  return (
    <main className="shell lobby-shell" data-theme="mafia" data-faction="mafia" data-family="mafia">
      <LobbyCreateClient initialMode="mafia_free" family="mafia" />
    </main>
  );
}
