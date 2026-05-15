import type { Metadata } from "next";
import { AnonymousEntryClient } from "@/components/games/anonymous-entry-client";
import { requireSession } from "@/lib/require-session";

export const metadata: Metadata = {
  title: "Влез в Мафия | Върколак и Мафия",
  description: "Влез с твоя профил и кода за частна Мафия стая.",
};

export default async function MafiaJoinPage({ params }: { params: Promise<{ roomCode?: string[] }> }) {
  const { roomCode } = await params;
  const initialCode = roomCode?.[0] ?? "";
  await requireSession(`/mafia/join${initialCode ? `/${initialCode}` : ""}`);

  return (
    <main className="shell lobby-shell" data-theme="mafia" data-family="mafia">
      <AnonymousEntryClient family="mafia" mode="mafia_free" initialCode={initialCode} />
    </main>
  );
}
