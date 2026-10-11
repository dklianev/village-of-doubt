import type { Metadata } from "next";
import { FriendsBook } from "@/components/friends/FriendsBook";
import { FriendsHeader } from "@/components/friends/FriendsHeader";
import { requireSession } from "@/lib/require-session";
import styles from "@/components/friends/Friends.module.css";

export const metadata: Metadata = {
  title: "Познати на масата",
  description: "Локален списък с хора за следващата стая и бърза покана за следваща игра.",
  robots: { index: false, follow: false },
};

export const instant = false;

type FriendsPageProps = {
  searchParams?: Promise<{ visualAuth?: string | string[] }>;
};

export default async function FriendsPage({ searchParams }: FriendsPageProps) {
  const visualAuth = firstSearchValue((await searchParams)?.visualAuth);
  if (process.env.NODE_ENV === "production" || visualAuth !== "1") {
    await requireSession("/friends");
  }

  return (
    <main className={styles.page}>
      <FriendsHeader />
      <FriendsBook />
    </main>
  );
}

function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
