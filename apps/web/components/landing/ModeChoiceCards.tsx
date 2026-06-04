"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { LastFamilyPill } from "@/components/landing/LastFamilyPill";

type LastFamily = "werewolves" | "mafia";
type LandingSession = { user: { id: string; name?: string | null } } | null;

export type ModeChoiceGame = {
  id: "werewolf" | "mafia";
  family: LastFamily;
  title: string;
  eyebrow: string;
  description: string;
  line: string;
  href: string;
};

export function ModeChoiceCards({ games, initialSession }: { games: readonly ModeChoiceGame[]; initialSession: LandingSession }) {
  const sessionQuery = authClient.useSession();
  const session = sessionQuery.data ?? initialSession;

  return (
    <div className="game-choice-grid landing-split-grid mt-8">
      {games.map((game) => {
        const primaryHref = session ? `${game.href}/create` : `/sign-in?redirect=${encodeURIComponent(`${game.href}/create`)}`;

        return (
          <article
            key={game.id}
            className={`game-choice-card game-choice-${game.id}`}
            data-faction={game.family}
            data-family={game.family}
          >
            <LastFamilyPill family={game.family} />
            <span className="section-kicker">{game.eyebrow}</span>
            <h2>{game.title}</h2>
            <blockquote>{game.line}</blockquote>
            <p>{game.description}</p>
            <div className="game-choice-actions">
              <Link href={primaryHref} className="btn btn-primary">
                {session ? "Избери игра" : "Влез и играй"}
              </Link>
              <Link href={`${game.href}/roles`} className="btn btn-secondary">
                Роли
              </Link>
              <Link href={`${game.href}/rules`} className="btn btn-secondary">
                Правила
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
