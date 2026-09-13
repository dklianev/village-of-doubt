import { Eye, Gavel, Mic2, ScrollText, Skull, Users, Vote } from "lucide-react";
import type { PublicEventKind } from "@werewolf/shared";
import type { PublicEvent } from "@/lib/play/types";

const eventIcons: Record<PublicEventKind, typeof ScrollText> = {
  system: ScrollText, presence: Users, narrator: Mic2, mayor: Gavel,
  phase: ScrollText, nomination: Gavel, vote: Vote,
  death: Skull, hunter_shot: Skull, reveal: Eye,
};

export function PublicEventLine({ event }: { event: PublicEvent }) {
  const Icon = eventIcons[event.type];
  return (
    <p className="event-line play-public-event" data-event-type={event.type}>
      <Icon className="play-event-icon" aria-hidden strokeWidth={1.7} />
      <span>{event.messageBg}</span>
    </p>
  );
}
