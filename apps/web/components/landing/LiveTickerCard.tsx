import Link from "next/link";
import type { GameFamily } from "@werewolf/shared";

export type LiveStats = {
  activeRooms: number;
  connectedPlayers: number;
  byFamily?: Partial<Record<GameFamily, number>>;
};

type LiveTickerCardProps = {
  family: GameFamily | null;
  liveStats: LiveStats | null;
};

export function LiveTickerCard({ family, liveStats }: LiveTickerCardProps) {
  const root = family === "mafia" ? "/mafia" : "/werewolf";
  const totalRooms = liveStats?.activeRooms ?? 0;
  const totalPlayers = liveStats?.connectedPlayers ?? 0;
  const familyRooms = family && liveStats?.byFamily ? liveStats.byFamily[family] ?? 0 : null;
  const visibleRooms = family ? (familyRooms ?? totalRooms) : totalRooms;
  const isEmpty = visibleRooms === 0 && totalPlayers === 0;

  return (
    <article className="quickstart-live quickstart-mini-card">
      <p className="section-kicker">в момента играят</p>
      {isEmpty ? (
        family === null ? (
          <div className="quickstart-empty-live quickstart-empty-live--homepage">
            <span className="quickstart-dice quickstart-dice--sealed" aria-hidden="true">
              ⚂
            </span>
            <div className="quickstart-invitation-copy">
              <p className="quickstart-sealed-tag">ОЧАКВАТ СЕ ГОСТИ</p>
              <h3>{emptyHeading(family)}</h3>
              <p>Покани приятели или сподели кода — стаята започва с теб.</p>
              <Link href={`${root}/create`} className="quickstart-card-cta">
                Създай стая <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="quickstart-empty-live">
            <span className="quickstart-dice" aria-hidden="true">
              ⚂
            </span>
            <div>
              <h3>{emptyHeading(family)}</h3>
              <p>{emptyBody(family)}</p>
              <Link href={`${root}/create`} className="quickstart-card-cta">
                Създай стая <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        )
      ) : (
        <div className="quickstart-live-active">
          <span className="quickstart-pulse" aria-hidden="true" />
          <div>
            <strong className="quickstart-live-count">
              {formatLine({ family, totalRooms, totalPlayers, byFamily: liveStats?.byFamily })}
            </strong>
            <p>Сега се играе</p>
          </div>
        </div>
      )}
    </article>
  );
}

function emptyHeading(family: GameFamily | null) {
  if (family === "werewolves") {
    return "Запали първия огън";
  }
  if (family === "mafia") {
    return "Бъди първият на масата";
  }
  return "Бъди първият на масата";
}

function emptyBody(family: GameFamily | null) {
  if (family === "werewolves") {
    return "Няма активни села в момента.";
  }
  if (family === "mafia") {
    return "Няма активни маси в момента.";
  }
  return "Няма активни стаи в момента.";
}

function formatLine({
  family,
  totalRooms,
  totalPlayers,
  byFamily,
}: {
  family: GameFamily | null;
  totalRooms: number;
  totalPlayers: number;
  byFamily: Partial<Record<GameFamily, number>> | undefined;
}) {
  if (family === "werewolves") {
    const rooms = byFamily?.werewolves ?? totalRooms;
    return `${rooms} ${roomWord(rooms, "село")} тази вечер`;
  }

  if (family === "mafia") {
    const rooms = byFamily?.mafia ?? totalRooms;
    return `${rooms} ${roomWord(rooms, "маса")} под напрежение`;
  }

  if (byFamily && (typeof byFamily.werewolves === "number" || typeof byFamily.mafia === "number")) {
    const werewolfRooms = byFamily.werewolves ?? 0;
    const mafiaRooms = byFamily.mafia ?? 0;
    return `${werewolfRooms} ${roomWord(werewolfRooms, "село")} · ${mafiaRooms} ${roomWord(mafiaRooms, "маса")} · ${totalPlayers} ${playerWord(totalPlayers)}`;
  }

  return `${totalRooms} ${roomWord(totalRooms, "стая")} · ${totalPlayers} ${playerWord(totalPlayers)}`;
}

function roomWord(count: number, kind: "стая" | "маса" | "село") {
  if (kind === "стая") {
    return count === 1 ? "стая" : "стаи";
  }
  if (kind === "маса") {
    return count === 1 ? "маса" : "маси";
  }
  return count === 1 ? "село" : "села";
}

function playerWord(count: number) {
  return count === 1 ? "човек" : "души";
}
