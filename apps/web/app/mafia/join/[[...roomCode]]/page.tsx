import type { Metadata } from "next";
import { AuthGatedEntryClient } from "@/components/games/auth-gated-entry-client";
import { requireSession } from "@/lib/require-session";

export const metadata: Metadata = {
  title: "Седни на масата",
  description: "Покажи кода на бара и седни на масата с приятели в Мафия.",
};

export const instant = false;

export default async function MafiaJoinPage({ params }: { params: Promise<{ roomCode?: string[] }> }) {
  const { roomCode } = await params;
  const initialCode = roomCode?.[0] ?? "";
  const session = await requireSession(`/mafia/join${initialCode ? `/${initialCode}` : ""}`);
  const initialSession = {
    user: {
      id: session.user.id,
      name: session.user.name,
    },
  };

  return (
    <main className="shell lobby-shell join-shell" data-faction="mafia" data-family="mafia">
      <div className="join-shell-inner">
        <AuthGatedEntryClient
          family="mafia"
          mode="mafia_free"
          initialCode={initialCode}
          initialSession={initialSession}
        />
      </div>
    </main>
  );
}
