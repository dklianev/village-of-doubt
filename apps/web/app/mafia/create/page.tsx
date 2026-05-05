import type { Metadata } from "next";
import { LobbyCreateClient } from "@/components/lobby-create-client";

export const metadata: Metadata = {
  title: "Създай стая за Мафия | Върколак и Мафия",
  description: "Настрой частна маса за Мафия без регистрация.",
};

export default function MafiaCreatePage() {
  return (
    <main className="shell lobby-shell" data-theme="mafia" data-family="mafia">
      <LobbyCreateClient initialMode="mafia_free" family="mafia" />
    </main>
  );
}
