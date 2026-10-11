export const TUTORIAL_MODES = ["werewolves_classic", "mafia_free", "mafia_sport"] as const;
export type TutorialMode = (typeof TUTORIAL_MODES)[number];
export type PlayerId = "anna" | "boris" | "galya";

export const TUTORIAL_PLAYERS = [
  { id: "anna", name: "Анна", portrait: "f01" },
  { id: "boris", name: "Борис", portrait: "m02" },
  { id: "galya", name: "Галя", portrait: "f03" },
] as const;

export interface TutorialPractice {
  night: PlayerId | null;
  vote: PlayerId | null;
  visited: PlayerId[];
}

export interface TutorialSceneProps {
  mode: TutorialMode;
  practice: TutorialPractice;
  onPracticeChange: (practice: TutorialPractice) => void;
  continueHref: string | null;
  onScene?: (scene: number) => void;
}

export function tutorialMode(game: string | null, redirect: string | null): TutorialMode {
  if (TUTORIAL_MODES.includes(game as TutorialMode)) return game as TutorialMode;
  if (redirect && /^\/mafia(?:[/?#]|$)/.test(redirect)) {
    return new URL(redirect, "https://example.invalid").searchParams.get("mode") === "mafia_sport"
      ? "mafia_sport" : "mafia_free";
  }
  return "werewolves_classic";
}

export function tutorialWorld(mode: TutorialMode) {
  const mafia = mode !== "werewolves_classic";
  return {
    mafia,
    family: mafia ? "mafia" : "werewolf",
    name: mode === "mafia_sport" ? "Спортна Мафия" : mafia ? "Мафия" : "Върколак",
    role: mafia ? "Комисар" : "Гадателка",
    town: mafia ? "Градът" : "Селото",
    create: mode === "mafia_sport" ? "/mafia/create?mode=mafia_sport" : mafia ? "/mafia/create" : "/werewolf/create",
    roleArt: mafia ? "/game-art/thumbs/mafia/role-commissioner.webp?v=3" : "/game-art/thumbs/role-seer.webp?v=3",
  };
}

export function readPractice(value: unknown): TutorialPractice {
  const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const isPlayer = (id: unknown): id is PlayerId => TUTORIAL_PLAYERS.some((player) => player.id === id);
  return {
    night: isPlayer(data.night) ? data.night : null,
    vote: isPlayer(data.vote) ? data.vote : null,
    visited: Array.isArray(data.visited) ? [...new Set(data.visited.filter(isPlayer))] : [],
  };
}

