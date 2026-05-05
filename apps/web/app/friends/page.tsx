import type { Metadata } from "next";
import { FriendsClient } from "@/components/friends-client";

export const metadata: Metadata = {
  title: "Приятели | Върколак и Мафия",
  description: "Локален списък с хора за следващата стая и бърза покана без акаунт.",
};

export default function FriendsPage() {
  return (
    <main className="shell utility-shell">
      <section className="paper-card utility-hero rounded-[2rem] p-8">
        <p className="section-kicker text-[#842f2b]">приятели</p>
        <h1 className="mt-3 text-5xl font-black">Покани групата без акаунти</h1>
        <p className="mt-4 max-w-3xl text-[#4f3829]">
          Докато основният flow е anonymous, списъкът с приятели е локален помощник: имена, бележки и бърза покана.
          Нищо не се качва в профил и няма скрит login.
        </p>
      </section>
      <FriendsClient />
    </main>
  );
}
