import { formatNewspaperDate, issueNumber } from "@/lib/leaderboard-headlines";

export function Masthead({ issueCount }: { issueCount: number }) {
  const today = new Date();

  return (
    <header className="masthead">
      <div className="masthead-ornament" aria-hidden="true">
        <svg viewBox="0 0 60 14" width="60" height="14">
          <path d="M0 7 L25 7 M35 7 L60 7" stroke="currentColor" strokeWidth="1" />
          <circle cx="30" cy="7" r="2" fill="currentColor" />
        </svg>
      </div>
      <h1 className="masthead-title">Вечерен Брой на Масата</h1>
      <p className="masthead-meta">
        Брой № {issueNumber(issueCount)} · {formatNewspaperDate(today)} · Издание след игра
      </p>
      <div className="masthead-ornament" aria-hidden="true">
        <svg viewBox="0 0 60 14" width="60" height="14">
          <path d="M0 7 L25 7 M35 7 L60 7" stroke="currentColor" strokeWidth="1" />
          <circle cx="30" cy="7" r="2" fill="currentColor" />
        </svg>
      </div>
    </header>
  );
}
