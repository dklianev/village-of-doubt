import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GameStatsContent } from "../game-home-page";
import { SportMafiaCallout } from "../SportMafiaCallout";

function markup(node: React.ReactNode) {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(node);
  return container;
}

describe("family secondary sections", () => {
  it("shows the real sport composition with ten non-interactive seats", () => {
    const html = markup(<SportMafiaCallout />);
    expect(html.querySelectorAll('[data-sport-team="town"]')).toHaveLength(7);
    expect(html.querySelectorAll('[data-sport-team="mafia"]')).toHaveLength(3);
    expect(html.querySelectorAll("button")).toHaveLength(0);
    expect(html.querySelector('a[href="/mafia/create?mode=mafia_sport"]')).not.toBeNull();
    expect(html.textContent).toContain("10 играчи");
  });

  it.each(["werewolves", "mafia"] as const)("keeps unavailable %s data compact and distinct from zero games", (family) => {
    const unavailable = markup(<GameStatsContent family={family} stats={null} />);
    expect(unavailable.querySelectorAll(".family-stats-unavailable")).toHaveLength(1);
    expect(unavailable.querySelector(".quickstart-mini-card")).toBeNull();
    expect(unavailable.textContent).toContain("Временно няма връзка с данните за игрите.");
    expect(unavailable.textContent).not.toContain("Няма активни");

    const empty = markup(<GameStatsContent family={family} stats={{
      liveStats: { activeRooms: 0, connectedPlayers: 0, byFamily: { werewolves: 0, mafia: 0 } },
      recentEndings: [],
    }} />);
    expect(empty.querySelector(".family-stats-unavailable")).toBeNull();
    expect(empty.querySelectorAll(".quickstart-mini-card")).toHaveLength(2);
    expect(empty.textContent).toContain(family === "mafia" ? "Няма активни маси" : "Няма активни села");
  });

  it("retains real family activity and endings when data is available", () => {
    const html = markup(<GameStatsContent family="mafia" stats={{
      liveStats: { activeRooms: 5, connectedPlayers: 36, byFamily: { werewolves: 3, mafia: 2 } },
      recentEndings: [{ code: "AB2345", family: "mafia", winnerTeam: "mafia" }],
    }} />);
    expect(html.textContent).toContain("2 маси");
    expect(html.textContent).toContain("AB2345");
    expect(html.textContent).not.toContain("Временно няма връзка");
  });
});
