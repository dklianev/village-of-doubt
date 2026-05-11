"use client";

import { Suspense } from "react";
import type { GameFamily, GameMode } from "@werewolf/shared";
import { LobbyWizard } from "@/components/lobby/LobbyWizard";
import { roleThumbStyle } from "@/lib/role-art";

void roleThumbStyle;

export function LobbyCreateClient({
  initialMode = "werewolves_classic",
  family,
}: {
  initialMode?: GameMode;
  family?: GameFamily;
}) {
  return (
    <Suspense
      fallback={
        <div className="lobby-step-pane">
          <p className="lobby-kicker">Създай частна стая</p>
          <h1>Зареждане на стаята...</h1>
        </div>
      }
    >
      <LobbyWizard initialMode={initialMode} family={family} />
    </Suspense>
  );
}
