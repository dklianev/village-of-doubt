interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return <span className={`skeleton ${className}`} aria-hidden="true" />;
}

export function HistoryListSkeleton() {
  return (
    <div className="mt-7 grid gap-4">
      {[0, 1, 2].map((item) => (
        <article key={item} className="history-game-card skeleton-card rounded-3xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="grid flex-1 gap-3">
              <Skeleton className="h-4 w-48 rounded-full" />
              <Skeleton className="h-8 w-64 rounded-full" />
            </div>
            <Skeleton className="h-10 w-28 rounded-full" />
          </div>
          <Skeleton className="mt-5 h-4 w-full max-w-xl rounded-full" />
          <Skeleton className="mt-5 h-24 w-full rounded-[1.35rem]" />
        </article>
      ))}
    </div>
  );
}

export function LeaderboardSkeleton() {
  return (
    <article className="newspaper-page newspaper-skeleton">
      <div className="masthead">
        <Skeleton className="h-12 w-full max-w-lg rounded-full" />
        <Skeleton className="h-4 w-80 max-w-full rounded-full" />
      </div>
      <Skeleton className="h-14 w-full max-w-3xl rounded-full" />
      <div className="headline-main-grid mt-6">
        <Skeleton className="h-[360px] w-full rounded-sm" />
        <div className="grid content-start gap-4">
          <Skeleton className="h-7 w-full rounded-full" />
          <Skeleton className="h-7 w-5/6 rounded-full" />
          <Skeleton className="h-24 w-full rounded-sm" />
        </div>
      </div>
    </article>
  );
}

export function PlayerTokensSkeleton() {
  return (
    <>
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="player-token skeleton-card rounded-2xl px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-2xl" />
              <div className="grid gap-2">
                <Skeleton className="h-5 w-32 rounded-full" />
                <Skeleton className="h-3 w-20 rounded-full" />
              </div>
            </div>
            <Skeleton className="h-7 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </>
  );
}
