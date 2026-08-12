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

const GAME_CHOICE_ART = {
  werewolf: {
    desktopAvif: "/game-art/bg-lobby-tavern.avif",
    desktopWebp: "/game-art/bg-lobby-tavern.webp",
    mobileWebp: "/game-art/mobile/bg-lobby-tavern.webp",
  },
  mafia: {
    desktopAvif: "/game-art/mafia/bg-lobby-tavern.avif",
    desktopWebp: "/game-art/mafia/bg-lobby-tavern.webp",
    mobileWebp: "/game-art/mobile/mafia/bg-lobby-tavern.webp",
  },
} as const;

export function ModeChoiceCards({ games, initialSession }: { games: readonly ModeChoiceGame[]; initialSession: LandingSession }) {
  const sessionQuery = authClient.useSession();
  const session = sessionQuery.data ?? initialSession;
  const sessionPending = sessionQuery.isPending && !initialSession;

  return (
    <div className="game-choice-grid landing-split-grid mt-8">
      {games.map((game) => {
        const art = GAME_CHOICE_ART[game.id];
        const prioritizeArt = game.id === "werewolf";
        const createHref = `${game.href}/create`;
        const primaryHref = sessionPending
          ? createHref
          : session
            ? createHref
            : `/sign-in?redirect=${encodeURIComponent(createHref)}`;

        return (
          <article
            key={game.id}
            className={`game-choice-card game-choice-${game.id}`}
            data-faction={game.family}
            data-family={game.family}
          >
            <picture className="game-choice-art" aria-hidden="true">
              <source media="(max-width: 767px)" srcSet={art.mobileWebp} />
              <source type="image/avif" srcSet={art.desktopAvif} />
              <img
                src={art.desktopWebp}
                alt=""
                width="1600"
                height="1000"
                loading={prioritizeArt ? "eager" : "lazy"}
                fetchPriority={prioritizeArt ? "high" : "low"}
                decoding={prioritizeArt ? "sync" : "async"}
              />
            </picture>
            <LastFamilyPill family={game.family} />
            <span className="section-kicker">{game.eyebrow}</span>
            <h2>{game.title}</h2>
            <blockquote>{game.line}</blockquote>
            <p>{game.description}</p>
            <div className="game-choice-actions">
              <Link href={primaryHref} className="btn btn-primary" aria-busy={sessionPending || undefined}>
                {sessionPending ? "Играй" : session ? "Избери игра" : "Влез и играй"}
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
