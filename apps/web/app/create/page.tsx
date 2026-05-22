import type { Metadata } from "next";
import { LobbyCreateClient } from "@/components/lobby-create-client";
import { requireSession } from "@/lib/require-session";
import { GAME_MODE_DEFINITIONS, getGameFamily, type GameMode } from "@werewolf/shared";

export const metadata: Metadata = {
  title: "Създай игра | Върколак и Мафия",
  description: "Избери готова рецепта за Върколак или Мафия и създай частна стая за секунди.",
};

export default async function CreatePage({ searchParams }: { searchParams?: Promise<{ mode?: string }> }) {
  const params = await searchParams;
  const initialMode = parseMode(params?.mode);
  const redirectTo = params?.mode ? `/create?mode=${encodeURIComponent(params.mode)}` : "/create";
  await requireSession(redirectTo);

  return (
    <main className="shell lobby-shell" data-theme={getGameFamily(initialMode)}>
      <LobbyCreateClient initialMode={initialMode} />
    </main>
  );
}

function parseMode(value: string | undefined): GameMode {
  return value && value in GAME_MODE_DEFINITIONS ? (value as GameMode) : "werewolves_classic";
}
