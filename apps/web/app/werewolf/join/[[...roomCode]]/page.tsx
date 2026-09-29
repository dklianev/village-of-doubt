import type { Metadata } from "next";
import { AuthGatedEntryClient } from "@/components/games/auth-gated-entry-client";
import { requireSession } from "@/lib/require-session";

export const metadata: Metadata = {
  title: "Влез в селото",
  description: "Влез с код в стая за Върколак с приятели.",
};

export const instant = false;

export default async function WerewolfJoinPage({ params, searchParams }: {
  params: Promise<{ roomCode?: string[] }>;
  searchParams?: Promise<{ visualAuth?: string | string[] }>;
}) {
  const { roomCode } = await params;
  const initialCode = roomCode?.[0] ?? "";
  const query = await searchParams;
  const visualAuth = Array.isArray(query?.visualAuth) ? query.visualAuth[0] : query?.visualAuth;
  const session = process.env.NODE_ENV !== "production" && visualAuth === "1"
    ? { user: { id: "visual-join-player", name: "Рада" } }
    : await requireSession(`/werewolf/join${initialCode ? `/${initialCode}` : ""}`);
  const initialSession = {
    user: {
      id: session.user.id,
      name: session.user.name,
    },
  };

  return (
    <main className="join-shell" data-faction="werewolves" data-family="werewolves">
      <div className="join-shell-inner">
        <AuthGatedEntryClient
          key={initialCode}
          family="werewolves"
          mode="werewolves_classic"
          initialCode={initialCode}
          initialSession={initialSession}
        />
      </div>
    </main>
  );
}
