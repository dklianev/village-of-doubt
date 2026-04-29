import { LobbyCreateClient } from "@/components/lobby-create-client";

export default function MafiaCreatePage() {
  return (
    <main className="shell lobby-shell" data-theme="mafia" data-family="mafia">
      <LobbyCreateClient initialMode="mafia_free" family="mafia" />
    </main>
  );
}
