"use client";

import { useEffect, useState } from "react";
import { safeLocalStorage } from "@/lib/safe-storage";

type LastFamily = "werewolves" | "mafia";

export function LastFamilyPill({ family }: { family: LastFamily }) {
  const [lastFamily, setLastFamily] = useState<LastFamily | null>(null);

  useEffect(() => {
    const saved = safeLocalStorage.getItem("last-family");
    if (saved === "werewolves" || saved === "mafia") {
      setLastFamily(saved);
    }
  }, []);

  return lastFamily === family ? <span className="mode-choice-continue-pill">Продължи</span> : null;
}
