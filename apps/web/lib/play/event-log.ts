import type { PublicEventKind } from "@werewolf/shared";

export function eventLineClass(type: PublicEventKind) {
  switch (type) {
    case "hunter_shot":
      return "event-hunter-shot";
    case "death":
      return "event-death";
    case "reveal":
      return "event-reveal";
    default:
      return "event-generic";
  }
}
