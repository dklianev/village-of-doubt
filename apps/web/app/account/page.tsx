import type { Metadata } from "next";
import { AccountClient } from "@/components/account/AccountClient";
import { requireSession } from "@/lib/require-session";

export const metadata: Metadata = {
  title: "Моят профил | Върколак и Мафия",
  description: "Преглед на профила и управление на изтриването.",
};

export default async function AccountPage() {
  const session = await requireSession("/account");

  return (
    <main className="shell utility-shell account-shell">
      <section className="paper-card account-card rounded-[2rem] p-8">
        <p className="section-kicker text-[#842f2b]">профил</p>
        <h1 className="mt-3 text-5xl font-black">Моят профил</h1>
        <AccountClient
          name={session.user.name ?? "Играч"}
          email={session.user.email ?? ""}
          image={session.user.image ?? ""}
        />
      </section>
    </main>
  );
}
