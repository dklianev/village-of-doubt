import type { GameFamily, GamePhase } from "@werewolf/shared";

export function nextPhaseTransitionArtHref(
  phase: GamePhase,
  family: GameFamily,
  mobile: boolean,
) {
  const nextPhase = nextVisualPhase(phase);
  const mobileSegment = mobile ? "mobile/" : "";

  if (family === "mafia") {
    return `/game-art/${mobileSegment}mafia/${phaseArtFile(nextPhase)}.webp`;
  }

  if (nextPhase === "role_reveal") {
    return `/game-art/${mobileSegment}bg-role-reveal.webp`;
  }

  const file = transitionArtFile(nextPhase);
  return `/game-art/${mobileSegment}${file}.webp`;
}

function phaseArtFile(phase: GamePhase) {
  switch (phase) {
    case "lobby":
    case "paused":
      return "bg-lobby-tavern";
    case "role_reveal":
      return "bg-role-reveal";
    case "first_night":
    case "night":
      return "bg-night-phase";
    case "day_announcement":
    case "day_discussion":
    case "nomination":
    case "defense":
      return "bg-day-discussion";
    case "voting":
      return "bg-voting";
    case "resolution":
    case "hunter_revenge":
    case "mayor_successor":
    case "game_over":
      return "bg-resolution";
  }
}

function nextVisualPhase(phase: GamePhase): GamePhase {
  switch (phase) {
    case "lobby":
      return "role_reveal";
    case "role_reveal":
      return "first_night";
    case "first_night":
    case "night":
      return "day_announcement";
    case "day_announcement":
    case "day_discussion":
    case "nomination":
    case "defense":
      return "voting";
    case "voting":
      return "resolution";
    case "resolution":
    case "hunter_revenge":
    case "mayor_successor":
      return "night";
    case "game_over":
      return "resolution";
    case "paused":
      return "lobby";
  }
}

function transitionArtFile(phase: GamePhase) {
  switch (phase) {
    case "lobby":
    case "paused":
      return "bg-lobby-tavern";
    case "role_reveal":
      return "bg-role-reveal";
    case "first_night":
    case "night":
      return "transition-night-falls";
    case "day_announcement":
    case "day_discussion":
    case "nomination":
    case "defense":
      return "transition-village-wakes";
    case "voting":
      return "transition-voting-starts";
    case "resolution":
    case "hunter_revenge":
    case "mayor_successor":
    case "game_over":
      return "transition-resolution";
  }
}
