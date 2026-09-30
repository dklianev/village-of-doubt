import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ROLE_DEFINITIONS, teamLabelBg, type GameFamily, type RoleCode } from "@werewolf/shared";
import { roleGuideBg } from "@/lib/play/private-copy";
import { roleThumbPath } from "@/lib/role-art";
import { useModal } from "@/lib/use-modal";
import styles from "./RoleRevealRitual.module.css";

const CARD_BACK = "/game-art/thumbs/card-back-secret.webp";

/**
 * Owns the "turned once" state inside the lazy chunk, so the /play entry only carries the
 * lazy reference. The play room keys it per room and role, which resets it for a new deal.
 */
export function RoleRevealGate({
  role,
  family,
  transitioning,
}: {
  role: { role: RoleCode; roleNameBg: string };
  family: GameFamily;
  transitioning: boolean;
}) {
  const [done, setDone] = useState(false);
  if (done) return null;
  return <RoleRevealRitual role={role} family={family} enterDelayMs={transitioning ? 1750 : 0} onDone={() => setDone(true)} />;
}

/**
 * The first private moment of a game: the dealt card arrives face down and the player
 * turns it when nobody else is looking. Purely presentational: it shows the private role
 * the server already sent to this player and never infers anything about other players.
 */
export function RoleRevealRitual({
  role,
  family,
  enterDelayMs = 0,
  onDone,
}: {
  role: { role: RoleCode; roleNameBg: string };
  family: GameFamily;
  /** Lets the phase curtain finish before the card is dealt. */
  enterDelayMs?: number;
  onDone: () => void;
}) {
  const [flipped, setFlipped] = useState(false);
  // The portal target only exists in the browser; server and first client render emit nothing.
  const [mounted, setMounted] = useState(false);
  const doneRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  // Lives here rather than in the play room so the lazy chunk, not the /play entry, carries it.
  const finish = () => {
    onDone();
    // Land on the private toggle so the card can be checked again from where it now lives.
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".play-personal-toggle")?.focus());
  };
  const { ref } = useModal<HTMLDivElement>({ open: mounted, onClose: finish });
  const definition = ROLE_DEFINITIONS[role.role];
  const guide = roleGuideBg(role.role, family);
  const roleArt = roleThumbPath(family, role.role);
  // Face down means nothing of the role in the DOM either; the art is warmed off-DOM so the turn is not blank.
  const cardStyle = flipped ? ({ "--ritual-role-art": `url("${roleArt}")` } as CSSProperties) : undefined;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const image = new Image();
    image.src = roleArt;
  }, [roleArt]);

  useEffect(() => {
    if (flipped) doneRef.current?.focus();
  }, [flipped]);

  if (!mounted) return null;

  // Portalled so the ceremony also dims the site chrome (the play shell is its own stacking context).
  return createPortal(
    <div
      className={styles.backdrop}
      role="presentation"
      data-family={family}
      style={{ "--ritual-enter-delay": `${enterDelayMs}ms` } as CSSProperties}
    >
      <div
        ref={ref}
        className={styles.stage}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        data-flipped={flipped ? "true" : "false"}
        data-team={definition.team}
      >
        {/* Tapping the card is a pointer shortcut; the labelled button below is the accessible control. */}
        <div className={styles.card} style={cardStyle} onClick={() => setFlipped(true)} aria-hidden="true">
          <span className={styles.cardInner}>
            <span className={`${styles.face} ${styles.back}`} style={{ backgroundImage: `url("${CARD_BACK}")` }} />
            <span className={`${styles.face} ${styles.front}`}>
              {flipped ? <span className={styles.frontName}>{role.roleNameBg}</span> : null}
            </span>
          </span>
        </div>

        <div className={styles.copy} aria-live="polite">
          {flipped ? (
            <>
              <p className={styles.kicker}>{teamLabelBg(definition.team, family)}</p>
              <h2 id={titleId} className={styles.title}>{role.roleNameBg}</h2>
              <p id={descriptionId} className={styles.summary}>{guide.summary}</p>
              <p className={styles.goal}><span>Цел</span>{guide.win}</p>
              <button ref={doneRef} type="button" className="btn btn-primary" onClick={finish}>
                Запомних
              </button>
              <p className={styles.note}>Картата се скрива. Виж я отново от „Виж ролята си“.</p>
            </>
          ) : (
            <>
              <p className={styles.kicker}>Картите са раздадени</p>
              <h2 id={titleId} className={styles.title}>Твоята тайна карта</h2>
              <p id={descriptionId} className={styles.summary}>Увери се, че никой друг не гледа екрана ти.</p>
              <button type="button" className="btn btn-primary" onClick={() => setFlipped(true)}>
                Обърни картата
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
