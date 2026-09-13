"use client";

import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { GameFamily, RoleCode } from "@werewolf/shared";
import { RoleDossier } from "./RoleDossier";
import "./RoleDossierTrigger.module.css";

let dismissActiveDossier: (() => void) | null = null;

export type RoleDossierTriggerProps = {
  family: GameFamily;
  role: RoleCode;
  className?: string;
  children: ReactNode;
};

export function RoleDossierTrigger({ family, role, className, children }: RoleDossierTriggerProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(function closeDossier() {
    if (dismissActiveDossier === closeDossier) dismissActiveDossier = null;
    setOpen(false);
  }, []);

  useLayoutEffect(() => close, [close]);
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={["role-dossier-trigger", className].filter(Boolean).join(" ")}
        data-role={role}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          // Keep a single owner even when activations precede the portal's effects.
          dismissActiveDossier?.();
          dismissActiveDossier = close;
          setOpen(true);
        }}
      >
        {children}
      </button>
      {open ? <RoleDossier family={family} role={role} onClose={close} returnFocusRef={triggerRef} /> : null}
    </>
  );
}
