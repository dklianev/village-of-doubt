import type { Metadata } from "next";
import { Suspense } from "react";
import { LobbyCreateClient, LobbyCreateLoading } from "@/components/lobby-create-client";
import { requireSession } from "@/lib/require-session";

export const metadata: Metadata = {
  title: "Създай стая за Мафия",
  description: "Настрой частна маса за Мафия с твоето досие.",
};

export const instant = true;

type MafiaCreatePageProps = {
  searchParams?: Promise<{ mode?: string | string[]; visualAuth?: string | string[] }>;
};

type MafiaCreateRouteContentProps = {
  searchParams: MafiaCreatePageProps["searchParams"];
};

export default function MafiaCreatePage({ searchParams }: MafiaCreatePageProps) {
  return (
    <main className="shell lobby-shell" data-faction="mafia" data-family="mafia">
      <Suspense fallback={<LobbyCreateLoading />}>
        <MafiaCreateRouteContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function MafiaCreateRouteContent({
  searchParams,
}: MafiaCreateRouteContentProps) {
  const params = await searchParams;
  const mode = params?.mode === "mafia_sport" || params?.mode === "mafia_free"
    ? params.mode
    : undefined;
  const redirectTo = mode
    ? `/mafia/create?${new URLSearchParams({ mode })}`
    : "/mafia/create";
  const visualAuth = firstSearchValue(params?.visualAuth);
  if (process.env.NODE_ENV === "production" || visualAuth !== "1") {
    await requireSession(redirectTo);
  }

  return <LobbyCreateClient initialMode={mode ?? "mafia_free"} family="mafia" />;
}

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
