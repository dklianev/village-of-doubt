import type { Metadata } from "next";
import { AuthGatedEntryClient } from "@/components/games/auth-gated-entry-client";
import { requireSession } from "@/lib/require-session";

export const metadata: Metadata = {
  title: "Влез в селото",
  description: "Покажи знака на селото и премини през оградата във Върколак.",
};

export const instant = false;

export default async function WerewolfJoinPage({ params }: { params: Promise<{ roomCode?: string[] }> }) {
  const { roomCode } = await params;
  const initialCode = roomCode?.[0] ?? "";
  await requireSession(`/werewolf/join${initialCode ? `/${initialCode}` : ""}`);

  return (
    <main className="shell lobby-shell join-shell" data-faction="werewolves" data-family="werewolves">
      <div className="join-shell-inner">
        <AuthGatedEntryClient family="werewolves" mode="werewolves_classic" initialCode={initialCode} />
      </div>
    </main>
  );
}
