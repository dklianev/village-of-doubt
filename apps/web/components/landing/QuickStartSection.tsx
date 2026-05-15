"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import type { GameFamily } from "@werewolf/shared";
import {
  BallotIcon,
  HouseIcon,
  KeyIcon,
  LastWinnerEmptyGlyph,
  MaskIcon,
  MoonIcon,
} from "@/components/landing/quickstart-icons";

export type LandingQuickStartLiveStats = {
  activeRooms: number;
  connectedPlayers: number;
  byFamily?: Partial<Record<GameFamily, number>>;
};

export type LandingQuickStartLastWinner = {
  code: string;
  winnerTeam: string;
  winnerReasonBg?: string;
  family?: GameFamily;
  endedAt?: string;
};

type QuickStartSectionProps = {
  liveStats: LandingQuickStartLiveStats | null;
  lastWinner: LandingQuickStartLastWinner | null;
};

const STEPS = [
  {
    label: "Вход",
    body: "Влизаш с Google, Discord или имейл.",
    icon: <KeyIcon />,
  },
  {
    label: "Стая",
    body: "Създаваш код или се присъединяваш към приятел.",
    icon: <HouseIcon />,
  },
  {
    label: "Роля",
    body: "Сървърът ти показва само твоята карта.",
    icon: <MaskIcon />,
  },
  {
    label: "Нощ",
    body: "Действаш тихо, ако ролята ти го позволява.",
    icon: <MoonIcon />,
  },
  {
    label: "Глас",
    body: "Денят решава кой ще напусне играта.",
    icon: <BallotIcon />,
  },
] as const;

export function QuickStartSection({ liveStats, lastWinner }: QuickStartSectionProps) {
  const stepsRef = useRef<HTMLOListElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const node = stepsRef.current;
    if (!node || revealed) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.2 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [revealed]);

  return (
    <section className="landing-quickstart" aria-label="Първа игра за 30 секунди">
      <div className="quickstart-surface">
        <div className="quickstart-header">
          <div>
            <p className="section-kicker">първа игра за 30 секунди</p>
            <h2>Как започва добра игра</h2>
            <p>Влез, избери стая, играй.</p>
          </div>
          <Link href="/werewolf/rules" className="quickstart-rules-cta" prefetch={false}>
            Виж пълните правила <span aria-hidden="true">→</span>
          </Link>
        </div>

        <ol ref={stepsRef} className="quickstart-steps" data-revealed={revealed ? "true" : "false"}>
          {STEPS.map((step, index) => (
            <li
              key={step.label}
              className="quickstart-step-slot"
              style={{ "--connector-index": index } as CSSProperties & Record<"--connector-index", number>}
            >
              <StepMedallion number={index + 1} icon={step.icon} label={step.label} body={step.body} />
              {index < STEPS.length - 1 ? <StepConnector /> : null}
            </li>
          ))}
        </ol>
      </div>

      <div className="quickstart-row">
        <LiveTickerCard liveStats={liveStats} />
        <LastWinnerCard lastWinner={lastWinner} />
      </div>
    </section>
  );
}

function StepMedallion({ number, icon, label, body }: { number: number; icon: ReactNode; label: string; body: string }) {
  return (
    <article className="quickstart-step">
      <span className="quickstart-medallion">{number}</span>
      <span className="quickstart-glyph">{icon}</span>
      <h3>{label}</h3>
      <p>{body}</p>
    </article>
  );
}

function StepConnector() {
  return (
    <span className="quickstart-connector" aria-hidden="true">
      <i />
      <i />
    </span>
  );
}

function LiveTickerCard({ liveStats }: { liveStats: LandingQuickStartLiveStats | null }) {
  const activeRooms = liveStats?.activeRooms ?? 0;
  const connectedPlayers = liveStats?.connectedPlayers ?? 0;

  return (
    <article className="quickstart-mini-card quickstart-live">
      <p className="section-kicker">в момента играят</p>
      {activeRooms === 0 && connectedPlayers === 0 ? (
        <div className="quickstart-empty-live">
          <span className="quickstart-dice" aria-hidden="true">
            ⚂
          </span>
          <div>
            <h3>Бъди първият на масата</h3>
            <p>Няма активни стаи в момента.</p>
            <Link href="/werewolf/create" className="quickstart-card-cta" prefetch={false}>
              Създай стая <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="quickstart-live-active">
          <span className="quickstart-pulse" aria-hidden="true" />
          <div>
            <strong className="quickstart-live-count">{formatLiveStats(liveStats)}</strong>
            <p>Сега се играе</p>
          </div>
        </div>
      )}
    </article>
  );
}

function LastWinnerCard({ lastWinner }: { lastWinner: LandingQuickStartLastWinner | null }) {
  return (
    <article className="quickstart-mini-card quickstart-winner">
      <p className="section-kicker">последна история</p>
      {lastWinner ? (
        <div className="quickstart-winner-active">
          {lastWinner.family ? <span className="quickstart-winner-mark">{familyBadgeBg(lastWinner.family)}</span> : null}
          {/* TODO: family from server when the stats endpoint starts returning it consistently. */}
          <div>
            <h3>
              Стая {lastWinner.code} — {winnerTeamBg(lastWinner.winnerTeam)}
            </h3>
            <small>{lastWinner.endedAt ? relativeTimeBg(lastWinner.endedAt) : lastWinner.winnerReasonBg ?? "Завършена игра"}</small>
          </div>
        </div>
      ) : (
        <div className="quickstart-winner-empty">
          <LastWinnerEmptyGlyph className="quickstart-dim-glyph" />
          <div>
            <h3>Първите герои ще се появят тук.</h3>
            <p>След първата завършена игра.</p>
          </div>
        </div>
      )}
    </article>
  );
}

function formatLiveStats(liveStats: LandingQuickStartLiveStats | null) {
  const activeRooms = liveStats?.activeRooms ?? 0;
  const connectedPlayers = liveStats?.connectedPlayers ?? 0;
  const byFamily = liveStats?.byFamily;

  if (byFamily && (typeof byFamily.werewolves === "number" || typeof byFamily.mafia === "number")) {
    const werewolfRooms = byFamily.werewolves ?? 0;
    const mafiaRooms = byFamily.mafia ?? 0;
    return `${werewolfRooms} ${roomWordBg(werewolfRooms)} Върколак · ${mafiaRooms} ${roomWordBg(mafiaRooms)} Мафия · ${connectedPlayers} ${playerWordBg(connectedPlayers)} общо`;
  }

  // TODO: byFamily breakdown when the stats endpoint exposes per-family room counts.
  return `${activeRooms} ${roomWordBg(activeRooms)} · ${connectedPlayers} ${playerWordBg(connectedPlayers)}`;
}

function roomWordBg(count: number) {
  return count === 1 ? "стая" : "стаи";
}

function playerWordBg(count: number) {
  return count === 1 ? "човек" : "души";
}

function familyBadgeBg(family: GameFamily) {
  return family === "mafia" ? "🎲 Мафия" : "🌒 Върколак";
}

function winnerTeamBg(team: string) {
  const labels: Record<string, string> = {
    village: "Селото",
    werewolves: "Върколаците",
    vampires: "Вампирите",
    mafia: "Мафията",
    lovers: "Влюбените",
    draw: "Равенство",
  };

  return labels[team] ?? "неизвестен победител";
}

function relativeTimeBg(value: string) {
  const endedAt = new Date(value).getTime();
  if (!Number.isFinite(endedAt)) {
    return "Завършена игра";
  }

  const minutes = Math.max(1, Math.round((Date.now() - endedAt) / 60_000));
  if (minutes < 60) {
    return `преди ${minutes} мин.`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `преди ${hours} ч.`;
  }

  return `преди ${Math.round(hours / 24)} д.`;
}
