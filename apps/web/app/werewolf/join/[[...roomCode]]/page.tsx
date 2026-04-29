import { AnonymousEntryClient } from "@/components/games/anonymous-entry-client";

export default async function WerewolfJoinPage({ params }: { params: Promise<{ roomCode?: string[] }> }) {
  const { roomCode } = await params;

  return (
    <main className="shell lobby-shell" data-theme="werewolves" data-family="werewolves">
      <AnonymousEntryClient family="werewolves" mode="werewolves_classic" initialCode={roomCode?.[0] ?? ""} />
    </main>
  );
}
