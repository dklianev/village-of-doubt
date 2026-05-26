import type { Metadata } from "next";
import { OfflineClient } from "@/components/offline-client";

export const metadata: Metadata = {
  title: "Без връзка",
  description: "Страница за възстановяване, когато връзката временно прекъсне.",
};

export default function OfflinePage() {
  return (
    <main className="shell offline-shell framed-shell">
      <div className="framed-shell-inner">
        <OfflineClient />
      </div>
    </main>
  );
}
