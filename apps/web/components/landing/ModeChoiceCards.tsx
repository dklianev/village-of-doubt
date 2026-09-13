"use client";

import Link from "next/link";
import { getImageProps } from "next/image";
import { LastFamilyPill } from "@/components/landing/LastFamilyPill";
import { useAuthSession } from "@/lib/use-auth-session";

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
  recommendedPlayers: string;
};

const GAME_CHOICE_ART = {
  werewolf: {
    dark: "choice-werewolf-dark-v7",
    light: "choice-werewolf-light-v7",
    height: 1024,
  },
  mafia: {
    dark: "choice-mafia-dark-v5",
    light: "choice-mafia-light-v5",
    height: 1022,
  },
} as const;

const GAME_CHOICE_ART_SIZES = "(max-width: 640px) calc(100vw - 38px), (max-width: 1212px) calc((100vw - 104px) / 2), 554px";

export function ModeChoiceCards({ games, initialSession }: { games: readonly ModeChoiceGame[]; initialSession: LandingSession }) {
  const sessionQuery = useAuthSession(initialSession);
  const session = sessionQuery.data ?? initialSession;
  const sessionPending = sessionQuery.isPending && !initialSession;

  return (
    <div className="game-choice-grid landing-split-grid mt-8">
      {games.map((game) => {
        const art = GAME_CHOICE_ART[game.id];
        const prioritizeArt = game.id === "werewolf";
        const createHref = `${game.href}/create`;
        const primaryHref = session || sessionPending || sessionQuery.isError
          ? createHref
          : `/sign-in?redirect=${encodeURIComponent(createHref)}`;

        return (
          <article
            key={game.id}
            className={`game-choice-card game-choice-${game.id}`}
            data-faction={game.family}
            data-family={game.family}
          >
            <div className="game-choice-scene">
              {(["dark", "light"] as const).map((theme) => {
                const { props: image } = getImageProps({
                  alt: "",
                  sizes: GAME_CHOICE_ART_SIZES,
                  quality: 85,
                  src: `/game-art/homepage/${art[theme]}.webp`,
                  width: 1536,
                  height: art.height,
                  loading: "lazy",
                  fetchPriority: prioritizeArt ? "high" : "low",
                });
                return (
                  <picture key={theme} className={`game-choice-art game-choice-art--${theme}`} aria-hidden="true">
                    <img {...image} />
                  </picture>
                );
              })}
              <span className="section-kicker">{game.eyebrow}</span>
            </div>
            <div className="game-choice-content">
              <h2>{game.title}</h2>
              <blockquote>{game.line}</blockquote>
              <p className="game-choice-description">{game.description}</p>
              <p className="game-choice-players">{game.recommendedPlayers}</p>
              <div className="game-choice-actions">
                <Link href={primaryHref} prefetch={false} className="btn btn-primary" aria-busy={sessionPending || undefined}>
                  Създай стая
                </Link>
                <Link href={`${game.href}/join`} prefetch={false} className="btn btn-secondary">
                  Имам код
                </Link>
              </div>
              <div className="game-choice-reference-links">
                <Link href={`${game.href}/roles`} prefetch={false}>
                  Роли
                </Link>
                <Link href={`${game.href}/rules`} prefetch={false}>
                  Правила
                </Link>
                <LastFamilyPill family={game.family} />
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
