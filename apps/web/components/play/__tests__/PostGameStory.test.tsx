import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PostGameStory } from "../PostGameStory";
import type { GameSnapshot, PublicEvent } from "@/lib/play/types";

function snapshot(publicEvents: PublicEvent[]): GameSnapshot {
  return {
    code: "STORY", mode: "werewolves_classic", playerCount: 6,
    narratorMode: "automatic", communicationMode: "built_in_chat", tempoProfile: "normal_online",
    dayDiscussionSeconds: 180, voteSeconds: 60, revealRolesOnDeath: false,
    loversEnabled: false, allowSkipVote: true, majorityMode: "simple", narratorVoice: "classic",
    phase: "game_over", round: 3, phaseEndsAt: 0, winnerTeam: "village", winnerReasonBg: "",
    players: [], roleCounts: [{ role: "seer", count: 1 }], voteTally: [], publicEvents, publicChat: [],
  };
}

describe("PostGameStory", () => {
  it("keeps actual public game moments when lifecycle chatter follows them", () => {
    const moments: PublicEvent[] = [
      { id: "death", type: "death", messageBg: "Анна беше елиминирана." },
      { id: "tie", type: "vote", messageBg: "Равенство. Никой не е елиминиран." },
      { id: "shot", type: "hunter_shot", messageBg: "Борис падна от последния изстрел на Ловеца." },
    ];
    const chatter: PublicEvent[] = Array.from({ length: 8 }, (_, index) => ({ id: `presence-${index}`, type: "presence", messageBg: "Играч напусна стаята." }));
    render(<PostGameStory snapshot={snapshot([...moments, ...chatter])} />);
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(moments.map((event) => event.messageBg));
    expect(screen.queryByText("Играч напусна стаята.")).not.toBeInTheDocument();
    expect(screen.queryByText(/Гадателка|seer/u)).not.toBeInTheDocument();
  });

  it("prioritizes eliminations and public reveals over routine votes, then restores chronology", () => {
    const events: PublicEvent[] = [
      { id: "death", type: "death", messageBg: "Анна беше елиминирана." },
      ...Array.from({ length: 6 }, (_, index): PublicEvent => ({ id: `vote-${index}`, type: "vote", messageBg: `Публичен глас ${index}.` })),
      { id: "reveal", type: "reveal", messageBg: "Благословия спря нощна смърт." },
    ];
    render(<PostGameStory snapshot={snapshot(events)} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(5);
    expect(items[0]).toHaveTextContent("Анна беше елиминирана.");
    expect(items[4]).toHaveTextContent("Благословия спря нощна смърт.");
  });

  it("does not fabricate story moments when the public history has none", () => {
    render(<PostGameStory snapshot={snapshot([{ id: "phase", type: "phase", messageBg: "Фаза: Край на играта." }])} />);
    expect(screen.getByText("Няма записани ключови публични събития.")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });
});
