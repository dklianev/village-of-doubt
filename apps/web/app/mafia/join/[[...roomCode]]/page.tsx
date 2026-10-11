import type { Metadata } from "next";
import { AuthGatedEntryClient } from "@/components/games/auth-gated-entry-client";
import { requireSession } from "@/lib/require-session";

export const metadata: Metadata = {
  title: "Влез на масата",
  description: "Влез с код в стая за Мафия с приятели.",
};

export const instant = false;

export default async function MafiaJoinPage({ params, searchParams }: {
  params: Promise<{ roomCode?: string[] }>;
  searchParams?: Promise<{ visualAuth?: string | string[] }>;
}) {
  const { roomCode } = await params;
  const initialCode = roomCode?.[0] ?? "";
  const query = await searchParams;
  const visualAuth = Array.isArray(query?.visualAuth) ? query.visualAuth[0] : query?.visualAuth;
  const session = process.env.NODE_ENV !== "production" && visualAuth === "1"
    ? { user: { id: "visual-join-player", name: "Рада" } }
    : await requireSession(`/mafia/join${initialCode ? `/${initialCode}` : ""}`);
  const initialSession = {
    user: {
      id: session.user.id,
      name: session.user.name,
    },
  };

  return (
    <main className="join-shell" data-faction="mafia" data-family="mafia">
      <div className="join-shell-inner">
        <AuthGatedEntryClient
          key={initialCode}
          family="mafia"
          mode="mafia_free"
          initialCode={initialCode}
          initialSession={initialSession}
        />
      </div>
    </main>
  );
}
