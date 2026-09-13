"use client";

import { useId, type ReactNode, type Ref } from "react";
import { ChevronDown, ChevronUp, EyeOff, Users, Vote } from "lucide-react";
import styles from "./PlayActionDock.module.css";

export type PlayActionDockKind = "action" | "lobby" | "quiet";

interface PlayActionDockProps {
  eyebrow: string;
  heading: string;
  kind: PlayActionDockKind;
  compact: boolean;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  primaryContent: ReactNode;
  compactSummary?: ReactNode;
  toggleRef?: Ref<HTMLButtonElement>;
  privateAction?: boolean;
}

export function PlayActionDock({
  eyebrow,
  heading,
  kind,
  compact,
  expanded,
  onExpandedChange,
  primaryContent,
  compactSummary,
  toggleRef,
  privateAction = true,
}: PlayActionDockProps) {
  const hasPrimaryContent = primaryContent !== null && primaryContent !== false;
  const headingId = useId();
  const gridId = useId();
  const HeadingIcon = kind === "lobby" ? Users : privateAction ? EyeOff : Vote;
  const toggleSubject = kind === "lobby" ? "подробностите за стаята" : "личния ход";

  return (
    <section
      className={`play-action-dock play-section ${styles.root}`}
      data-play-command-surface
      data-dock-kind={kind}
      data-compact={compact ? "true" : "false"}
      data-expanded={expanded ? "true" : "false"}
      data-has-primary={hasPrimaryContent ? "true" : "false"}
      aria-labelledby={headingId}
    >
      <header className={`play-action-dock-head ${styles.header}`}>
        <div className={styles.headingGroup}>
          <p className={`section-kicker play-section-kicker ${styles.eyebrow}`}>
            <HeadingIcon aria-hidden="true" strokeWidth={1.8} />
            <span>{eyebrow}</span>
          </p>
          <h2 id={headingId}>{heading}</h2>
        </div>

        {compact && hasPrimaryContent ? (
          <button
            ref={toggleRef}
            className={`play-action-dock-toggle ${styles.toggle}`}
            type="button"
            aria-label={`${expanded ? "Скрий" : "Покажи"} ${toggleSubject}`}
            aria-expanded={expanded}
            aria-controls={gridId}
            onClick={() => onExpandedChange(!expanded)}
          >
            {expanded ? <ChevronDown aria-hidden="true" /> : <ChevronUp aria-hidden="true" />}
          </button>
        ) : null}
      </header>

      {compact && compactSummary ? <div className={styles.compactSummary}>{compactSummary}</div> : null}

      <div
        id={gridId}
        className={`play-action-dock-grid ${styles.grid}`}
        hidden={compact && !expanded}
      >
        {hasPrimaryContent ? (
          <div className={styles.primaryColumn} role="group" aria-label="Текущо действие">
            {primaryContent}
          </div>
        ) : null}
      </div>
    </section>
  );
}
