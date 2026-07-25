import type { Metadata } from "next";
import { LobbyCreateClient } from "@/components/lobby-create-client";
import { GAME_MODE_DEFINITIONS, getGameFamily, type GameMode } from "@werewolf/shared";

export const metadata: Metadata = {
  title: "Лоби",
  description: "Създай частна стая, избери игра, роли, Разказвач и темпо.",
};

export default async function LobbyPage({ searchParams }: { searchParams?: Promise<{ mode?: string }> }) {
  const params = await searchParams;
  const initialMode = parseMode(params?.mode);
  const family = getGameFamily(initialMode);

  return (
    <main className="shell lobby-shell" data-faction={family} data-family={family}>
      <LobbyCreateClient initialMode={initialMode} family={family} />
    </main>
  );
}

function parseMode(value: string | undefined): GameMode {
  return value && value in GAME_MODE_DEFINITIONS ? (value as GameMode) : "werewolves_classic";
}
