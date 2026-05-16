import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Страницата я няма | Върколак и Мафия",
  description: "Тази страница не съществува. Върни се към масата.",
};

export default function NotFoundPage() {
  return (
    <main className="shell not-found-shell">
      <section className="paper-card not-found-card rounded-[2rem] p-8">
        <p className="section-kicker text-[#842f2b]">404</p>
        <h1 className="mt-3 text-5xl font-black">Страницата я няма на масата.</h1>
        <p className="mt-4 max-w-2xl text-[#4f3829]">
          Може кодът на стаята да е изтекъл, или линкът да е грешен. Върни се към началото или избери
          семейство игри.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
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
      </section>
    </main>
  );
}
