import type { Metadata } from "next";
import { AnonymousEntryClient } from "@/components/games/anonymous-entry-client";
import { requireSession } from "@/lib/require-session";

export const metadata: Metadata = {
  title: "Влез във Върколак | Върколак и Мафия",
  description: "Влез с твоя профил и кода за частно село във Върколак.",
};

export default async function WerewolfJoinPage({ params }: { params: Promise<{ roomCode?: string[] }> }) {
  const { roomCode } = await params;
  const initialCode = roomCode?.[0] ?? "";
  await requireSession(`/werewolf/join${initialCode ? `/${initialCode}` : ""}`);

  return (
    <main className="shell lobby-shell" data-theme="werewolves" data-family="werewolves">
      <AnonymousEntryClient family="werewolves" mode="werewolves_classic" initialCode={initialCode} />
    </main>
  );
}
