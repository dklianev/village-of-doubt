import type { Metadata } from "next";
import { AnonymousEntryClient } from "@/components/games/anonymous-entry-client";

export const metadata: Metadata = {
  title: "Влез във Върколак | Върколак и Мафия",
  description: "Въведи име и код за частно село във Върколак без регистрация.",
};

export default async function WerewolfJoinPage({ params }: { params: Promise<{ roomCode?: string[] }> }) {
  const { roomCode } = await params;

  return (
    <main className="shell join-shell" data-theme="werewolves" data-family="werewolves">
      <AnonymousEntryClient family="werewolves" mode="werewolves_classic" initialCode={roomCode?.[0] ?? ""} />
    </main>
  );
}
