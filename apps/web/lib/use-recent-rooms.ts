"use client";

import { useEffect, useState } from "react";
import { ROOM_CODE_REGEX, type GameFamily } from "@werewolf/shared";

const STORAGE_KEY = "werewolf-mafia:recent-rooms";
const MAX_VISIBLE_ENTRIES = 3;
const MAX_STORED_ENTRIES = 6;

export type RecentRoom = {
  code: string;
  family: GameFamily;
  visitedAt: number;
};

export function useRecentRooms(family: GameFamily) {
  const [rooms, setRooms] = useState<RecentRoom[]>([]);

  useEffect(() => {
    setRooms(readRooms(family));
  }, [family]);

  function remember(code: string) {
    if (!ROOM_CODE_REGEX.test(code)) {
      return;
    }

    try {
      const existing = readAllRooms();
      const next: RecentRoom[] = [
        { code, family, visitedAt: Date.now() },
        ...existing.filter((room) => !(room.code === code && room.family === family)),
      ].slice(0, MAX_STORED_ENTRIES);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setRooms(next.filter((room) => room.family === family).slice(0, MAX_VISIBLE_ENTRIES));
    } catch {
      // Local storage is a convenience only.
    }
  }

  return { rooms, remember };
}

function readRooms(family: GameFamily) {
  return readAllRooms()
    .filter((room) => room.family === family)
    .slice(0, MAX_VISIBLE_ENTRIES);
}

function readAllRooms() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as RecentRoom[];
    return parsed
      .filter(
        (room) =>
          (room.family === "mafia" || room.family === "werewolves") &&
          ROOM_CODE_REGEX.test(room.code) &&
          Number.isFinite(room.visitedAt),
      )
      .sort((a, b) => b.visitedAt - a.visitedAt);
  } catch {
    return [];
  }
}
