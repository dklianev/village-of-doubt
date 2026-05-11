"use client";

import { GAME_MODE_DEFINITIONS, getGameFamily, getGameModeNameBg, type GameMode } from "@werewolf/shared";

export function ModeTileCard({
  mode,
  active,
  onSelect,
}: {
  mode: GameMode;
  active: boolean;
  onSelect: (mode: GameMode) => void;
}) {
  const family = getGameFamily(mode);
  return (
    <button type="button" className="mode-tile-card" data-active={active} data-family={family} onClick={() => onSelect(mode)}>
      <span className={`mode-preview-strip mode-${mode}`} aria-hidden="true">
        <span>{getGameModeNameBg(mode)}</span>
      </span>
      <strong>{getGameModeNameBg(mode)}</strong>
      <small>{GAME_MODE_DEFINITIONS[mode].shortBg}</small>
    </button>
  );
}
