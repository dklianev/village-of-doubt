import type { Metadata } from "next";
import { AuthGatedEntryClient } from "@/components/games/auth-gated-entry-client";
import { requireSession } from "@/lib/require-session";

export const metadata: Metadata = {
  title: "Седни на масата | Върколак и Мафия",
  description: "Покажи кода на бара и седни на масата с приятели в Мафия.",
};

export default async function MafiaJoinPage({ params }: { params: Promise<{ roomCode?: string[] }> }) {
  const { roomCode } = await params;
  const initialCode = roomCode?.[0] ?? "";
  await requireSession(`/mafia/join${initialCode ? `/${initialCode}` : ""}`);

  return (
    <main className="shell lobby-shell join-shell" data-theme="mafia" data-faction="mafia" data-family="mafia">
      <div className="join-shell-inner">
        <AuthGatedEntryClient family="mafia" mode="mafia_free" initialCode={initialCode} />
      </div>
    </main>
  );
}
