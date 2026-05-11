"use client";

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
  return <LobbyWizard initialMode={initialMode} family={family} />;
}
