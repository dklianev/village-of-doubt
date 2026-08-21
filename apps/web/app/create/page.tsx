import type { Metadata } from "next";
import { Suspense } from "react";
import { LobbyCreateClient, LobbyCreateLoading } from "@/components/lobby-create-client";
import { requireSession } from "@/lib/require-session";
import { GAME_MODE_DEFINITIONS, getGameFamily, type GameMode } from "@werewolf/shared";

export const metadata: Metadata = {
  title: "Създай игра",
  description: "Избери готова рецепта за Върколак или Мафия и създай частна стая за секунди.",
};

type CreatePageProps = {
  searchParams?: Promise<{ mode?: string; visualAuth?: string | string[] }>;
};

type CreateRouteContentProps = {
  searchParams: CreatePageProps["searchParams"];
};

export default function CreatePage({ searchParams }: CreatePageProps) {
  return (
    <Suspense
      fallback={
        <main className="shell lobby-shell create-choice-shell">
          <LobbyCreateLoading />
        </main>
      }
    >
      <CreateRouteContent searchParams={searchParams} />
    </Suspense>
  );
}

async function CreateRouteContent({ searchParams }: CreateRouteContentProps) {
  const params = await searchParams;
  const initialMode = parseMode(params?.mode);
  const family = params?.mode && params.mode in GAME_MODE_DEFINITIONS ? getGameFamily(initialMode) : undefined;
  const redirectTo = params?.mode ? `/create?mode=${encodeURIComponent(params.mode)}` : "/create";
  const visualAuth = firstSearchValue(params?.visualAuth);
  if (process.env.NODE_ENV === "production" || visualAuth !== "1") {
    await requireSession(redirectTo);
  }

  return (
    <main className="shell lobby-shell create-choice-shell" data-faction={family} data-family={family}>
      <LobbyCreateClient initialMode={initialMode} />
    </main>
  );
}

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseMode(value: string | undefined): GameMode {
  return value && value in GAME_MODE_DEFINITIONS ? (value as GameMode) : "werewolves_classic";
}
