import { LobbyCreateClient } from "@/components/lobby-create-client";

export default function WerewolfCreatePage() {
  return (
    <main className="shell lobby-shell" data-theme="werewolves" data-family="werewolves">
      <LobbyCreateClient initialMode="werewolves_classic" family="werewolves" />
    </main>
  );
}
