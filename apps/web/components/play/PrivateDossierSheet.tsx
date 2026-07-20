"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Sheet } from "@werewolf/ui";
import styles from "./PlayActionDock.module.css";

interface PrivateDossierSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}

export default function PrivateDossierSheet({
  open,
  onOpenChange,
  title,
  children,
}: PrivateDossierSheetProps) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="Лично досие с твоята тайна роля и частни сведения."
    >
      <div className={styles.dossierSheet}>
        <button
          className={styles.dossierClose}
          type="button"
          aria-label="Затвори досието"
          onClick={() => onOpenChange(false)}
        >
          <X aria-hidden="true" strokeWidth={2} />
        </button>
        {children}
      </div>
    </Sheet>
  );
}
