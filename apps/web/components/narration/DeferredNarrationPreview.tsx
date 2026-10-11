import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import type { NarratorVoice } from "@werewolf/shared";
import styles from "./NarrationPreview.module.css";

type Preview = typeof import("./NarrationPreview")["NarrationPreview"];

/** Load the control when settings open, before its explicit playback gesture. */
export function DeferredNarrationPreview(props: { voice: NarratorVoice; disabled?: boolean }) {
  const [PreviewControl, setPreviewControl] = useState<Preview | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    setFailed(false);
    void import("./NarrationPreview").then((module) => {
      if (current) setPreviewControl(() => module.NarrationPreview);
    }).catch(() => { if (current) setFailed(true); });
    return () => { current = false; };
  }, [attempt]);
  if (PreviewControl) return <PreviewControl {...props} />;
  return <div className={styles.pending}>
    {failed ? <button type="button" className={styles.button} onClick={() => setAttempt(value => value + 1)}>
      <RotateCcw size={16} aria-hidden="true" />Опитай отново
    </button> : null}
    <p className={styles.status} role="status">{failed ? "Прослушването временно не е достъпно." : "Зареждаме прослушването..."}</p>
  </div>;
}
