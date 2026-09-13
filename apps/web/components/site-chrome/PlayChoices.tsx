import Link from "next/link";
import { ArrowRight, KeyRound } from "lucide-react";

export function PlayChoices({ onNavigate, includeJoin = false }: { onNavigate: () => void; includeJoin?: boolean }) {
  return <nav className="site-play-choices" aria-label="Нова игра">
    <Link href="/werewolf/create" className="site-game-choice" aria-label="Върколак" onNavigate={onNavigate}>
      <span className="site-game-emblem" data-family="werewolves" aria-hidden />
      <span>Върколак</span><ArrowRight aria-hidden />
    </Link>
    <Link href="/mafia/create" className="site-game-choice" aria-label="Мафия" onNavigate={onNavigate}>
      <span className="site-game-emblem" data-family="mafia" aria-hidden />
      <span>Мафия</span><ArrowRight aria-hidden />
    </Link>
    {includeJoin ? <Link href="/join" prefetch={false} className="site-play-join" onNavigate={onNavigate}>
      <KeyRound aria-hidden /><span>Имам код</span><ArrowRight aria-hidden />
    </Link> : null}
  </nav>;
}
