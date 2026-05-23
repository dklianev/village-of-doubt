import { Display, SceneCard } from "@werewolf/ui/server";
import { formatNewspaperDate, issueNumber } from "@/lib/leaderboard-headlines";

export function Masthead({ issueCount }: { issueCount: number }) {
  const today = new Date();

  return (
    <header className="leaderboard-hero-frame">
      <SceneCard eyebrow="ВЕЧЕРЕН БРОЙ" density="lg">
        <div className="masthead masthead-primitive">
          <div className="masthead-ornament" aria-hidden="true">
            <svg viewBox="0 0 60 14" width="60" height="14">
              <path d="M0 7 L25 7 M35 7 L60 7" stroke="currentColor" strokeWidth="1" />
              <circle cx="30" cy="7" r="2" fill="currentColor" />
            </svg>
          </div>
          <Display size="h1">Вечерен Брой на Масата</Display>
          <p className="masthead-meta">
            Брой № {issueNumber(issueCount)} · {formatNewspaperDate(today)} · Издание след игра
          </p>
          <div className="masthead-ornament" aria-hidden="true">
            <svg viewBox="0 0 60 14" width="60" height="14">
              <path d="M0 7 L25 7 M35 7 L60 7" stroke="currentColor" strokeWidth="1" />
              <circle cx="30" cy="7" r="2" fill="currentColor" />
            </svg>
          </div>
        </div>
      </SceneCard>
    </header>
  );
}
