"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type LastFamily = "werewolves" | "mafia";

export type ModeChoiceGame = {
  id: "werewolf" | "mafia";
  family: LastFamily;
  title: string;
  eyebrow: string;
  description: string;
  line: string;
  href: string;
};

export function ModeChoiceCards({ games }: { games: readonly ModeChoiceGame[] }) {
  const [lastFamily, setLastFamily] = useState<LastFamily | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("last-family");
    if (saved === "werewolves" || saved === "mafia") {
      setLastFamily(saved);
    }
  }, []);

  return (
    <div className="game-choice-grid landing-split-grid mt-8">
      {games.map((game) => {
        const isLastPlayed = lastFamily === game.family;

        return (
          <article
            key={game.id}
            className={`game-choice-card game-choice-${game.id}${isLastPlayed ? " is-last-played" : ""}`}
            data-theme={game.family}
          >
            {isLastPlayed ? <span className="mode-choice-continue-pill">Продължи</span> : null}
            <span className="section-kicker">{game.eyebrow}</span>
            <h2>{game.title}</h2>
            <blockquote>{game.line}</blockquote>
            <p>{game.description}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={`${game.href}/create`} className="btn btn-primary">
                Играй
              </Link>
              <Link href={`${game.href}/roles`} className="btn btn-secondary" prefetch={false}>
                Роли
              </Link>
              <Link href={`${game.href}/rules`} className="btn btn-secondary" prefetch={false}>
                Правила
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
