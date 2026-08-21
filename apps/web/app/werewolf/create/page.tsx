import type { Metadata } from "next";
import { Suspense } from "react";
import { LobbyCreateClient, LobbyCreateLoading } from "@/components/lobby-create-client";
import { requireSession } from "@/lib/require-session";

export const metadata: Metadata = {
  title: "Създай стая за Върколак",
  description: "Настрой частно село за Върколак с твоето досие.",
};

export const instant = true;

type WerewolfCreatePageProps = {
  searchParams?: Promise<{ visualAuth?: string | string[] }>;
};

type WerewolfCreateRouteContentProps = {
  searchParams: WerewolfCreatePageProps["searchParams"];
};

export default function WerewolfCreatePage({ searchParams }: WerewolfCreatePageProps) {
  return (
    <main className="shell lobby-shell" data-faction="werewolves" data-family="werewolves">
      <Suspense fallback={<LobbyCreateLoading />}>
        <WerewolfCreateRouteContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function WerewolfCreateRouteContent({
  searchParams,
}: WerewolfCreateRouteContentProps) {
  const visualAuth = firstSearchValue((await searchParams)?.visualAuth);
  if (process.env.NODE_ENV === "production" || visualAuth !== "1") {
    await requireSession("/werewolf/create");
  }

  return <LobbyCreateClient initialMode="werewolves_classic" family="werewolves" />;
}

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
