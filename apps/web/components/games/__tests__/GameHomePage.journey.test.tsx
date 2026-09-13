import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ROLE_DEFINITIONS, type RoleCode } from "@werewolf/shared";
import { GameHero, GameHomeClosing } from "../game-home-page";
import { RoleSpotlight } from "../RoleSpotlight";
import { VariantsChips } from "../VariantsChips";
import { WerewolfNightTimeline } from "../WerewolfNightTimeline";
import { MafiaNightTimeline } from "../MafiaNightTimeline";

function markup(node: React.ReactNode) {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(node);
  return container;
}

describe("family home journey", () => {
  it.each(["werewolves", "mafia"] as const)("keeps create and join explicit at both ends of %s", (family) => {
    const root = family === "mafia" ? "/mafia" : "/werewolf";
    for (const node of [<GameHero family={family} />, <GameHomeClosing family={family} />]) {
      const html = markup(node);
      expect(html.querySelector(`a[href="${root}/create"]`)?.textContent).toBe("Създай стая");
      expect(html.querySelector(`a[href="${root}/join"]`)?.textContent).toBe("Имам код");
    }
    expect(markup(<GameHero family={family} />).textContent).toContain(family === "mafia" ? "4–24 играчи" : "6–30 играчи");
  });

  it.each(["werewolves", "mafia"] as const)("opens real %s portraits in local dossiers", (family) => {
    const html = markup(<RoleSpotlight family={family} />);
    const links = html.querySelectorAll<HTMLButtonElement>('button[aria-haspopup="dialog"]');
    expect(links.length).toBeGreaterThanOrEqual(3);
    for (const link of links) {
      const role = link.dataset.role as RoleCode;
      expect(ROLE_DEFINITIONS[role].availableInFamilies).toContain(family);
      expect(link.textContent).toContain(ROLE_DEFINITIONS[role].nameBg);
      expect(link.querySelector("img")?.getAttribute("src")).not.toContain("/thumbs/");
    }
    expect(html.textContent).not.toContain("всяка игра");
    expect(html.textContent).not.toContain("Кой се събужда нощем");
  });

  it("does not advertise a mafia-only role in the werewolf variants", () => {
    const html = markup(<VariantsChips family="werewolves" />);
    expect(html.textContent).not.toContain("Маниак");
    expect(html.querySelector('button[data-role="cupid"][aria-haspopup="dialog"]')).not.toBeNull();
    expect(html.querySelector('button[data-role="vampire"][aria-haspopup="dialog"]')).not.toBeNull();
    expect(html.querySelector('a[href*="/roles?role="]')).toBeNull();
  });

  it.each([WerewolfNightTimeline, MafiaNightTimeline])("teaches the full game cycle, not an invented waking order", (Timeline) => {
    const html = markup(<Timeline />);
    const steps = [...html.querySelectorAll("h3")].map((heading) => heading.textContent);
    expect(steps).toEqual(["Нощ", "Обсъждане", "Гласуване"]);
    expect(html.querySelector('a[href$="/rules"]')).not.toBeNull();
  });
});
