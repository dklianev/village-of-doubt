"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ComponentType, type CSSProperties } from "react";
import type { GameFamily } from "@werewolf/shared";
import { BallotIcon, DoorIcon, KeyIcon, LastWinnerEmptyGlyph, MaskIcon, MoonIcon } from "./quickstart-icons";

export type QuickStartLiveStats = {
  activeRooms: number;
  connectedPlayers: number;
};

export type QuickStartLastWinner = {
  code: string;
  winnerTeam: string;
  winnerReasonBg?: string;
  endedAt?: string;
};

type QuickStartSectionProps = {
  family: GameFamily;
  liveStats: QuickStartLiveStats | null;
  lastWinner: QuickStartLastWinner | null;
};

const STEPS: Array<{
  label: string;
  body: string;
  Icon: ComponentType;
}> = [
  {
    label: "Вход",
    body: "Влизаш с Google, Discord или имейл.",
    Icon: KeyIcon,
  },
  {
    label: "Стая",
    body: "Създаваш код или се присъединяваш към приятел.",
    Icon: DoorIcon,
  },
  {
    label: "Роля",
    body: "Сървърът ти показва само твоята карта.",
    Icon: MaskIcon,
  },
  {
    label: "Нощ",
    body: "Действаш тихо, ако ролята ти го позволява.",
    Icon: MoonIcon,
  },
  {
    label: "Глас",
    body: "Денят решава кой ще напусне играта.",
    Icon: BallotIcon,
  },
];

export function QuickStartSection({ family, liveStats, lastWinner }: QuickStartSectionProps) {
  const root = family === "mafia" ? "/mafia" : "/werewolf";
  const stepsRef = useRef<HTMLOListElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const node = stepsRef.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px 260px 0px", threshold: 0.05 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="quickstart-block" aria-label="Първа игра за 30 секунди">
      <div className="quickstart-surface">
        <div className="quickstart-header">
          <div>
            <p className="section-kicker">първа игра за 30 секунди</p>
            <h2>Как започва добра игра</h2>
            <p>Влез, избери стая, играй.</p>
          </div>
          <Link href={`${root}/rules`} className="quickstart-rules-cta" prefetch={false}>
            Виж пълните правила <span aria-hidden="true">→</span>
          </Link>
        </div>

        <ol ref={stepsRef} className="quickstart-steps" data-revealed={revealed ? "true" : "false"}>
          {STEPS.map((step, index) => (
            <li key={step.label} className="quickstart-step-slot">
              <StepMedallion number={index + 1} label={step.label} body={step.body} Icon={step.Icon} />
              {index < STEPS.length - 1 ? <StepConnector index={index} /> : null}
            </li>
          ))}
        </ol>
      </div>

      <div className="quickstart-row">
        <LiveTickerCard family={family} liveStats={liveStats} />
        <LastWinnerCard lastWinner={lastWinner} />
      </div>
    </section>
  );
}

function StepMedallion({ number, label, body, Icon }: { number: number; label: string; body: string; Icon: ComponentType }) {
  return (
    <article className="quickstart-step">
      <span className="quickstart-medallion">{number}</span>
      <span className="quickstart-glyph">
        <Icon />
      </span>
      <h3>{label}</h3>
      <p>{body}</p>
    </article>
  );
}

function StepConnector({ index }: { index: number }) {
  return (
    <span className="quickstart-connector" style={{ "--connector-index": index } as CSSProperties} aria-hidden="true">
      <i />
      <i />
    </span>
  );
}

function LiveTickerCard({ family, liveStats }: { family: GameFamily; liveStats: QuickStartLiveStats | null }) {
  const root = family === "mafia" ? "/mafia" : "/werewolf";
  const activeRooms = liveStats?.activeRooms ?? 0;
  const connectedPlayers = liveStats?.connectedPlayers ?? 0;
  const isEmpty = activeRooms === 0 && connectedPlayers === 0;

  return (
    <article className="quickstart-live quickstart-mini-card">
      <p className="section-kicker">в момента играят</p>
      {isEmpty ? (
        <div className="quickstart-empty-live">
          <span className="quickstart-dice" aria-hidden="true">
            ⚂
          </span>
          <div>
            <h3>Бъди първият на масата</h3>
            <p>Няма активни стаи в момента.</p>
            <Link href={`${root}/create`} className="quickstart-card-cta" prefetch={false}>
              Създай стая <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="quickstart-live-active">
          <span className="quickstart-pulse" aria-hidden="true" />
          <div>
            <strong className="quickstart-live-count">
              {activeRooms} {activeRooms === 1 ? "стая" : "стаи"} · {connectedPlayers}{" "}
              {connectedPlayers === 1 ? "човек" : "души"}
            </strong>
            <p>Сега се играе</p>
          </div>
        </div>
      )}
    </article>
  );
}

function LastWinnerCard({ lastWinner }: { lastWinner: QuickStartLastWinner | null }) {
  return (
    <article className="quickstart-winner quickstart-mini-card">
      <p className="section-kicker">последна история</p>
      {lastWinner ? (
        <div className="quickstart-winner-active">
          <span className="quickstart-winner-mark" aria-hidden="true">
            {winnerGlyph(lastWinner.winnerTeam)}
          </span>
          <div>
            <h3>{winnerTeamBg(lastWinner.winnerTeam)}</h3>
            <p>
              Стая <strong>{lastWinner.code}</strong>
              {lastWinner.endedAt ? ` · ${timeAgoBg(lastWinner.endedAt)}` : ""}
            </p>
            {lastWinner.winnerReasonBg ? <small>{lastWinner.winnerReasonBg}</small> : null}
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

function winnerTeamBg(team: string) {
  const labels: Record<string, string> = {
    village: "Селото печели",
    werewolves: "Върколаците печелят",
    vampires: "Вампирите печелят",
    mafia: "Мафията печели",
    maniac: "Маниакът печели",
    lovers: "Влюбените печелят",
    draw: "Равенство",
  };

  return labels[team] ?? "Победителят е записан";
}

function winnerGlyph(team: string) {
  const glyphs: Record<string, string> = {
    village: "⌂",
    werewolves: "☾",
    vampires: "✦",
    mafia: "◆",
    maniac: "!",
    lovers: "♥",
    draw: "=",
  };

  return glyphs[team] ?? "✦";
}

function timeAgoBg(value: string) {
  const endedAt = new Date(value).getTime();
  if (!Number.isFinite(endedAt)) {
    return "скоро";
  }

  const diffMinutes = Math.max(1, Math.round((Date.now() - endedAt) / 60000));
  if (diffMinutes < 60) {
    return `преди ${diffMinutes} мин.`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `преди ${diffHours} ч.`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `преди ${diffDays} д.`;
}
