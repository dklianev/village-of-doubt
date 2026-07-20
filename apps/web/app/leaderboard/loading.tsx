import { LeaderboardSkeleton } from "@/components/skeleton";

export default function LeaderboardLoading() {
  return (
    <main className="shell newspaper-shell" aria-busy="true" aria-label="Зареждане на вечерния брой">
      <LeaderboardSkeleton />
    </main>
  );
}
