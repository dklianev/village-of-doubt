import { useEffect, useRef, useState } from "react";
import { BookOpen } from "lucide-react";
import type { RoleCode } from "@werewolf/shared";
import type { GameSnapshot, PublicPlayer } from "@/lib/play/types";
import styles from "./PlayTools.module.css";

export function PlayReference(props: {
  snapshot: GameSnapshot;
  privateRole: RoleCode | undefined;
  ownPlayer: PublicPlayer | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [Content, setContent] = useState<typeof import("./PlayReferenceContent").default | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open || Content) return;
    let active = true;
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", cancel);
    void import("./PlayReferenceContent").then(
      (module) => { if (active) setContent(() => module.default); },
      () => { if (active) { setOpen(false); setFailed(true); } },
    );
    return () => { active = false; window.removeEventListener("keydown", cancel); };
  }, [open, Content]);

  return <>
    <button ref={trigger} type="button" className={styles.tool} title="Правила" aria-haspopup="dialog" aria-expanded={open}
      aria-busy={open && !Content}
      onClick={() => { setTab(0); setFailed(false); setOpen(true); }}>
      <BookOpen aria-hidden="true" size={18} /><span>Правила</span>
    </button>
    {/* Keep the loaded surface mounted for its closing animation and focus return. */}
    {Content ? <Content {...props} open={open} onOpenChange={setOpen} trigger={trigger} tab={tab} setTab={setTab} /> : null}
    {open && !Content ? <span className="sr-only" role="status">Зареждаме правилата...</span> : null}
    {failed ? <p className={styles.loadError} role="status">Правилата не се заредиха. Опитай пак.</p> : null}
  </>;
}
