import { useLayoutEffect, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { Sheet } from "@werewolf/ui";
import styles from "./PlayTools.module.css";

export interface PlayToolSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  trigger: RefObject<HTMLButtonElement | null>;
  compact?: boolean;
  children: ReactNode;
}

export default function PlayToolSurface({ open, onOpenChange, title, trigger, compact = false, children }: PlayToolSheetProps) {
  const [position, setPosition] = useState<CSSProperties>({});
  useLayoutEffect(() => {
    if (!open) return;
    const align = () => {
      const button = trigger.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const theme = getComputedStyle(button);
      setPosition({
        ...Object.fromEntries(["paper", "ink", "muted", "border"].map((name) => [
          `--tool-${name}`, theme.getPropertyValue(`--play-console-${name}`),
        ])),
        ...(compact ? {
          "--tool-left": `${Math.max(16, Math.min(rect.right - 360, window.innerWidth - 376))}px`,
          "--tool-bottom": `${Math.min(Math.max(16, window.innerHeight - rect.top + 8), Math.max(16, window.innerHeight - 420))}px`,
        } : {}),
      } as CSSProperties);
    };
    align();
    window.addEventListener("resize", align);
    window.addEventListener("scroll", align);
    return () => {
      window.removeEventListener("resize", align);
      window.removeEventListener("scroll", align);
    };
  }, [open, compact, trigger]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} closeLabel="Затвори"
      className={`${styles.sheet} ${compact ? styles.settings : styles.reference}`} style={position}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        trigger.current?.focus({ preventScroll: true });
      }}>
      {children}
    </Sheet>
  );
}
