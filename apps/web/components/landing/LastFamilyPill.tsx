"use client";

import { useEffect, useState } from "react";

type LastFamily = "werewolves" | "mafia";

export function LastFamilyPill({ family }: { family: LastFamily }) {
  const [lastFamily, setLastFamily] = useState<LastFamily | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("last-family");
    if (saved === "werewolves" || saved === "mafia") {
      setLastFamily(saved);
    }
  }, []);

  return lastFamily === family ? <span className="mode-choice-continue-pill">Продължи</span> : null;
}
