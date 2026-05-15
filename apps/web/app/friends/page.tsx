import type { Metadata } from "next";
import { FriendsClient } from "@/components/friends-client";
import { requireSession } from "@/lib/require-session";

export const metadata: Metadata = {
  title: "Приятели | Върколак и Мафия",
  description: "Локален списък с хора за следващата стая и бърза покана за следваща игра.",
};

export default async function FriendsPage() {
  await requireSession("/friends");

  return (
    <main className="shell utility-shell">
      <section className="paper-card utility-hero rounded-[2rem] p-8">
        <p className="section-kicker text-[#842f2b]">приятели</p>
        <h1 className="mt-3 text-5xl font-black">Покани групата за следваща маса</h1>
        <p className="mt-4 max-w-3xl text-[#4f3829]">
          Списъкът с приятели е локален помощник: имена, бележки и бърза покана по код.
        </p>
      </section>
      <FriendsClient />
    </main>
  );
}
