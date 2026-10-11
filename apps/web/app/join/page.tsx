import type { Metadata } from "next";
import { normalizeRoomCodeInput, ROOM_CODE_REGEX } from "@werewolf/shared";
import { AuthGatedEntryClient } from "@/components/games/auth-gated-entry-client";
import { requireSession } from "@/lib/require-session";

export const metadata: Metadata = {
  title: "Влез с код",
  description: "Присъедини се към приятелите си във Върколак или Мафия.",
  robots: { index: false, follow: false },
};

export const instant = false;

export default async function JoinPage({ searchParams }: {
  searchParams?: Promise<{ code?: string | string[]; visualAuth?: string | string[] }>;
}) {
  const query = await searchParams;
  const code = normalizeRoomCodeInput(first(query?.code) ?? "");
  const initialCode = ROOM_CODE_REGEX.test(code) ? code : "";
  const returnTo = initialCode ? `/join?code=${encodeURIComponent(initialCode)}` : "/join";
  const session = process.env.NODE_ENV !== "production" && first(query?.visualAuth) === "1"
    ? { user: { id: "visual-join-player", name: "Рада" } }
    : await requireSession(returnTo);

  return (
    <main className="join-shell">
      <div className="join-shell-inner">
        <AuthGatedEntryClient
          key={initialCode}
          initialCode={initialCode}
          initialSession={{ user: { id: session.user.id, name: session.user.name } }}
        />
      </div>
    </main>
  );
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
