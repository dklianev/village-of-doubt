import type { Metadata } from "next";
import { LobbyCreateClient } from "@/components/lobby-create-client";

export const metadata: Metadata = {
  title: "Създай стая за Върколак | Върколак и Мафия",
  description: "Настрой частно село за Върколак без регистрация.",
};

export default function WerewolfCreatePage() {
  return (
    <main className="shell lobby-shell" data-theme="werewolves" data-family="werewolves">
      <LobbyCreateClient initialMode="werewolves_classic" family="werewolves" />
    </main>
  );
}
