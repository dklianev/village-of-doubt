"use client";

import { lazy, Suspense, useId, useState, type ReactNode, type Ref } from "react";
import { BookOpen, ChevronDown, ChevronUp, EyeOff } from "lucide-react";
import styles from "./PlayActionDock.module.css";

const PrivateDossierSheet = lazy(() => import("./PrivateDossierSheet"));

export type PlayActionDockKind = "action" | "lobby" | "quiet";

interface PlayActionDockProps {
  eyebrow: string;
  heading: string;
  kind: PlayActionDockKind;
  compact: boolean;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  primaryContent: ReactNode;
  privateContent: ReactNode;
  dossierTitle: string;
  toggleRef?: Ref<HTMLButtonElement>;
}

export function PlayActionDock({
  eyebrow,
  heading,
  kind,
  compact,
  expanded,
  onExpandedChange,
  primaryContent,
  privateContent,
  dossierTitle,
  toggleRef,
}: PlayActionDockProps) {
  const [dossierOpen, setDossierOpen] = useState(false);
  const hasPrimaryContent = primaryContent !== null && primaryContent !== false;
  const hasPrivateContent = privateContent !== null && privateContent !== false;
  const headingId = useId();
  const gridId = useId();

  return (
    <section
      className={`play-action-dock play-section ${styles.root}`}
      data-play-command-surface
      data-private-command-desk="true"
      data-dock-kind={kind}
      data-compact={compact ? "true" : "false"}
      data-expanded={expanded ? "true" : "false"}
      data-has-primary={hasPrimaryContent ? "true" : "false"}
      data-has-private={hasPrivateContent ? "true" : "false"}
      aria-labelledby={headingId}
    >
      <div className={styles.inlay} aria-hidden="true" />
      <header className={`play-action-dock-head ${styles.header}`}>
        <div className={styles.headingGroup}>
          <p className={`section-kicker play-section-kicker ${styles.eyebrow}`}>
            <EyeOff aria-hidden="true" strokeWidth={1.8} />
            <span>{eyebrow}</span>
          </p>
          <h2 id={headingId}>{heading}</h2>
        </div>

        <div className={styles.headerActions}>
          {compact && hasPrivateContent ? (
            <button
              className={styles.dossierButton}
              type="button"
              aria-label="Отвори тайното досие"
              onClick={() => setDossierOpen(true)}
            >
              <BookOpen aria-hidden="true" strokeWidth={2} />
              <span>Досие</span>
            </button>
          ) : null}

          {compact && hasPrimaryContent ? (
            <button
              ref={toggleRef}
              className={`play-action-dock-toggle ${styles.toggle}`}
              type="button"
              aria-label={expanded ? "Скрий личния ход" : "Покажи личния ход"}
              aria-expanded={expanded}
              aria-controls={gridId}
              onClick={() => onExpandedChange(!expanded)}
            >
              {expanded ? <ChevronDown aria-hidden="true" /> : <ChevronUp aria-hidden="true" />}
            </button>
          ) : null}
        </div>
      </header>

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
        {!compact && hasPrivateContent ? (
          <div className={styles.privateColumn} role="group" aria-label="Лично досие">
            {privateContent}
          </div>
        ) : null}
      </div>

      {compact && hasPrivateContent && dossierOpen ? (
        <Suspense fallback={null}>
          <PrivateDossierSheet
            open={dossierOpen}
            onOpenChange={setDossierOpen}
            title={dossierTitle}
          >
            {privateContent}
          </PrivateDossierSheet>
        </Suspense>
      ) : null}
    </section>
  );
}
