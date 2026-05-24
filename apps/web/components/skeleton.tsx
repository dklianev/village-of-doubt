import type { CSSProperties } from "react";
import "@/components/history/History.module.css";
import "@/components/play/PlayerToken.module.css";

interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({ className = "", style }: SkeletonProps) {
  return <span className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

export function SkeletonText({
  width = "100%",
  size = "default",
}: {
  width?: string;
  size?: "sm" | "default" | "lg" | "xl";
}) {
  const sizeClass = {
    sm: "skeleton-text-sm",
    default: "skeleton-text",
    lg: "skeleton-text-lg",
    xl: "skeleton-text-xl",
  }[size];

  return <Skeleton className={sizeClass} style={{ width }} />;
}

export function SkeletonAvatar({ className = "" }: SkeletonProps) {
  return <Skeleton className={`skeleton-avatar ${className}`} />;
}

export function SkeletonCard({ className = "" }: SkeletonProps) {
  return <div className={`skeleton skeleton-card-shell ${className}`} aria-hidden="true" />;
}

export function SkeletonHero({ className = "" }: SkeletonProps) {
  return <div className={`skeleton skeleton-hero ${className}`} aria-hidden="true" />;
}

export function PageSkeleton() {
  return (
    <section className="page-skeleton" aria-label="Зареждане">
      <SkeletonHero />
      <div className="page-skeleton-grid">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </section>
  );
}

export function HistoryListSkeleton() {
  return (
    <div className="mt-7 grid gap-4">
      {[0, 1, 2].map((item) => (
        <article key={item} className="history-game-card skeleton-card rounded-3xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="grid flex-1 gap-3">
              <SkeletonText width="12rem" size="sm" />
              <SkeletonText width="16rem" size="xl" />
            </div>
            <SkeletonText width="7rem" size="lg" />
          </div>
          <Skeleton className="mt-5 h-4 w-full max-w-xl rounded-full" />
          <SkeletonCard className="mt-5 h-24 w-full rounded-[1.35rem]" />
        </article>
      ))}
    </div>
  );
}

export function EvidenceWallSkeleton() {
  return (
    <>
      <header className="evidence-wall-header">
        <Skeleton className="h-4 w-24 rounded-full" />
        <Skeleton className="mt-5 h-16 w-full max-w-[520px] rounded-2xl" />
        <Skeleton className="mt-5 h-5 w-full max-w-[480px] rounded-full" />
      </header>
      <div className="evidence-filters">
        {[0, 1, 2, 3, 4].map((item) => (
          <Skeleton key={item} className="h-10 w-24 rounded-full" />
        ))}
      </div>
      <section className="evidence-wall">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <article key={item} className="case-file case-file-ghost">
            <span className="pushpin" />
            <div className="case-file-ghost-lines">
              <Skeleton className="h-4 w-2/3 rounded-full" />
              <Skeleton className="h-8 w-full rounded-xl" />
              <Skeleton className="h-4 w-5/6 rounded-full" />
            </div>
          </article>
        ))}
      </section>
    </>
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
