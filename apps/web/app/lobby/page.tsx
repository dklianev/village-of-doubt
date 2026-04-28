import { LobbyCreateClient } from "@/components/lobby-create-client";
import { GAME_MODE_DEFINITIONS, getGameFamily, type GameMode } from "@werewolf/shared";

export default async function LobbyPage({ searchParams }: { searchParams?: Promise<{ mode?: string }> }) {
  const params = await searchParams;
  const initialMode = parseMode(params?.mode);

  return (
    <main className="shell lobby-shell" data-theme={getGameFamily(initialMode)}>
      <LobbyCreateClient initialMode={initialMode} />
    </main>
  );
}

function parseMode(value: string | undefined): GameMode {
  return value && value in GAME_MODE_DEFINITIONS ? (value as GameMode) : "werewolves_classic";
}
