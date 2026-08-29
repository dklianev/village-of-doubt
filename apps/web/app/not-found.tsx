import type { Metadata } from "next";
import Link from "next/link";
import { PaperCard } from "@werewolf/ui/server";
import "@/components/system/SystemPages.module.css";

export const metadata: Metadata = {
  title: "Страницата я няма",
  description: "Тази страница не съществува. Върни се към масата.",
};

export default function NotFoundPage() {
  return (
    <main className="shell not-found-shell">
      <section className="not-found-card">
        <PaperCard eyebrow="404" density="lg">
          <h1 className="text-5xl font-black">Страницата я няма на масата.</h1>
          <p className="max-w-2xl" style={{ color: "var(--ds-ink-soft)" }}>
            Може кодът на стаята да е изтекъл, или линкът да е грешен. Върни се към началото или избери
            семейство игри.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link className="btn btn-primary" href="/">
              Към началото
            </Link>
            <Link className="btn btn-secondary" href="/werewolf">
              Върколак
            </Link>
            <Link className="btn btn-secondary" href="/mafia">
              Мафия
            </Link>
            <Link className="btn btn-secondary" href="/tutorial">
              Първа игра
            </Link>
          </div>
        </PaperCard>
      </section>
    </main>
  );
}
