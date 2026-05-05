import type { Metadata } from "next";
import { AnonymousEntryClient } from "@/components/games/anonymous-entry-client";

export const metadata: Metadata = {
  title: "Влез в Мафия | Върколак и Мафия",
  description: "Въведи име и код за частна Мафия стая без регистрация.",
};

export default async function MafiaJoinPage({ params }: { params: Promise<{ roomCode?: string[] }> }) {
  const { roomCode } = await params;

  return (
    <main className="shell lobby-shell" data-theme="mafia" data-family="mafia">
      <AnonymousEntryClient family="mafia" mode="mafia_free" initialCode={roomCode?.[0] ?? ""} />
    </main>
  );
}
