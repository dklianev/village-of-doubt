import { AnonymousEntryClient } from "@/components/games/anonymous-entry-client";

export default async function MafiaJoinPage({ params }: { params: Promise<{ roomCode?: string[] }> }) {
  const { roomCode } = await params;

  return (
    <main className="shell lobby-shell" data-theme="mafia" data-family="mafia">
      <AnonymousEntryClient family="mafia" mode="mafia_free" initialCode={roomCode?.[0] ?? ""} />
    </main>
  );
}
