import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, Heart, RotateCcw, CirclePlay, Share2, Trophy, Theater } from "lucide-react";
import { getGameFamily, ROLE_DEFINITIONS, type RoleCode } from "@werewolf/shared";
import type { GameSnapshot } from "@/lib/play/types";
import { ProfilePortrait } from "@/components/ProfilePortrait";
import { avatarIdForUser } from "@/lib/avatar-catalog";
import { canOpenRecordedReplay, historyHrefForGame, repeatGameHref } from "@/lib/play/post-game-links";
import { PostGameStory } from "./PostGameStory";
import styles from "./GameConclusion.module.css";

export interface GameConclusionProps {
  snapshot: GameSnapshot;
  recordedGameId: string | null;
  currentUserId: string;
}

const HEADINGS: Record<string, string> = {
  village: "Селото победи", town: "Градът победи", werewolves: "Върколаците победиха",
  mafia: "Мафията победи", vampires: "Вампирите победиха", maniac: "Маниакът победи",
  lovers: "Влюбените победиха", draw: "Няма победител",
};

export function GameConclusion({ snapshot, recordedGameId, currentUserId }: GameConclusionProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const family = getGameFamily(snapshot.mode);
  const familyPath = family === "mafia" ? "mafia" : "werewolf";
  const result = snapshot.phase === "game_over" && snapshot.terminalResult?.winnerTeam === snapshot.winnerTeam
    ? snapshot.terminalResult : undefined;
  const players = snapshot.players.filter((player) => player.playing);
  const roles = new Map(result?.finalRoles.map(({ userId, role }) => [userId, role]));
  const winners = new Set(result?.winnerPlayerIds);
  const personalWinners = new Set(result?.personalWinnerPlayerIds);
  const jesters = players.filter((player) => personalWinners.has(player.userId) && roles.get(player.userId) === "jester");
  const hasJester = jesters.length > 0;
  const scene = snapshot.winnerTeam === "village" && family === "mafia" ? "town"
    : Object.hasOwn(HEADINGS, snapshot.winnerTeam) ? snapshot.winnerTeam : "draw";
  const heading = scene === "draw" && personalWinners.size ? "Няма победил отбор" : HEADINGS[scene];
  const quietActions = !hasJester && (scene === "village" || scene === "lovers");
  const replayEligible = canOpenRecordedReplay(snapshot, currentUserId);
  const isRecorded = Boolean(recordedGameId && replayEligible);
  const revelationRef = useRef<HTMLElement>(null);
  const [revealed, setRevealed] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "copied" | "failed">("idle");

  // The roster sits below the finale scene: turn the cards when they are actually seen.
  useEffect(() => {
    const node = revelationRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      setRevealed(true);
      observer.disconnect();
    }, { threshold: 0.2 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Shares only the public outcome; the recorded replay keeps its own access checks.
  async function shareResult() {
    const url = isRecorded
      ? new URL(historyHrefForGame(recordedGameId, replayEligible), window.location.origin).toString()
      : window.location.origin;
    const text = `${heading}. Изиграхме ${family === "mafia" ? "Мафия" : "Върколак"} в Сенките.`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Сенките", text, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setShareState("copied");
    } catch {
      setShareState("failed");
    }
  }

  useEffect(() => {
    const active = document.activeElement;
    if (active === document.body || active === document.documentElement || active?.id === "main-content") {
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [snapshot.winnerTeam]);

  if (snapshot.phase !== "game_over" || !snapshot.winnerTeam) return null;

  return (
    <div className={styles.conclusion} data-endgame={scene} data-family={family} data-jester-win={hasJester || undefined}>
      <section className={styles.scene} aria-labelledby="conclusion-heading" data-daylight={["village", "town", "lovers"].includes(scene) || undefined}>
        <img className={styles.backdrop} src={`/game-art/endgame/${scene}-v1.webp`} alt="" fetchPriority="high" />
        <div className={styles.copy}>
          <h1 id="conclusion-heading" ref={headingRef} tabIndex={-1}>{heading}</h1>
          {snapshot.winnerReasonBg ? <p className={styles.reason}>{snapshot.winnerReasonBg}</p> : null}
          {hasJester ? <div className={styles.personal}>
            <div className={styles.personalRule} aria-hidden="true"><Theater size={27} /></div>
            <h2>{scene === "draw" ? "Но Шутът спечели." : "И Шутът ви изигра."}</h2>
            <p>{jesters.length === 1 ? `${jesters[0]?.displayName} беше Шут. Гласуването донесе лична победа.`
              : `${jesters.map((player) => player.displayName).join(", ")} спечелиха лично като Шут.`}</p>
          </div> : null}
          {/* Explicit natural tab stops keep these links reachable in WebKit's default keyboard mode. */}
          <div className={`${styles.actions} play-winner-actions`} data-quiet={quietActions || undefined}>
            <Link tabIndex={0} className="btn btn-primary" href={repeatGameHref(snapshot)}>{!quietActions && <RotateCcw size={23} className="shrink-0" aria-hidden="true" />}Още една игра</Link>
            <Link tabIndex={0} className="btn btn-secondary" href={historyHrefForGame(recordedGameId, replayEligible)}>{!quietActions && <CirclePlay size={23} className="shrink-0" aria-hidden="true" />}{isRecorded ? "Виж записа" : "Към архива"}</Link>
          </div>
        </div>
        {hasJester ? <img className={styles.jesterArtifact} src="/game-art/endgame/jester-v1.webp" alt="" width={960} height={600} /> : null}
      </section>

      <section ref={revelationRef} className={styles.revelation} aria-labelledby="conclusion-roles" data-revealed={revealed || undefined}>
        <header className={styles.sectionHeading}>
          <h2 id="conclusion-roles">Лицата зад сенките</h2>
          <Link tabIndex={0} href={`/${familyPath}/roles`}>Всички роли <ArrowRight size={18} aria-hidden="true" /></Link>
        </header>
        {!result ? <p role="status">Окончателното разкриване на ролите още не е получено.</p> : null}
        <ul className={styles.players}>
          {players.map((player, index) => {
            const role = roles.get(player.userId);
            const knownRole = role ?? (Object.hasOwn(ROLE_DEFINITIONS, player.revealedRole) ? player.revealedRole as RoleCode : undefined);
            const won = winners.has(player.userId);
            const personalWin = personalWinners.has(player.userId);
            return <li className={styles.player} key={player.userId} data-winner={won || undefined} data-personal-winner={personalWin || undefined} style={{ "--reveal-index": index } as CSSProperties}>
              <div className={styles.portrait}>
                <ProfilePortrait avatarId={avatarIdForUser(player.userId, player.avatarId)} decorative />
                {won ? <img className={styles.laurel} src="/game-art/endgame/laurel-v1.webp" width={320} height={320} alt="" /> : null}
                {personalWin ? <span className={styles.personalSeal} aria-hidden="true"><Theater /></span> : null}
              </div>
              <strong>{player.displayName}</strong>
              <span className={styles.role}>{knownRole ? ROLE_DEFINITIONS[knownRole].nameBg : "Ролята не е разкрита"}</span>
              {won ? <span className={styles.winnerLabel}>{scene === "lovers" ? <Heart size={14} aria-hidden="true" /> : <Trophy size={14} aria-hidden="true" />}Победител</span> : null}
              {personalWin ? <span className={styles.personalLabel}>Лична победа</span> : null}
            </li>;
          })}
        </ul>
      </section>
      <div className={styles.afterword}>
        <button type="button" className={styles.share} onClick={() => void shareResult()} aria-live="polite">
          <Share2 size={18} aria-hidden="true" />
          {shareState === "copied" ? "Копирано — пусни го в групата" : shareState === "failed" ? "Не успяхме да копираме връзката" : "Сподели резултата"}
        </button>
        <p className={styles.repeatNote}>
          <strong>Край на играта · {snapshot.round} {snapshot.round === 1 ? "рунд" : "рунда"}</strong><br />
          Нова стая{snapshot.nextRoomOptions ? " със същите настройки" : " за следващата вечер"}. Участниците се канят отново.
        </p>
        <PostGameStory snapshot={snapshot} />
      </div>
    </div>
  );
}
