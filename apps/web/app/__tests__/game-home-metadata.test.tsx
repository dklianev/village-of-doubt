import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MafiaPage, { metadata as mafiaMetadata } from "@/app/mafia/page";
import WerewolfPage, { metadata as werewolfMetadata } from "@/app/werewolf/page";

vi.mock("@/components/games/game-home-page", () => ({ GameHomePage: () => null }));

describe.each([
  { path: "/werewolf", Page: WerewolfPage, metadata: werewolfMetadata, min: 6, max: 30 },
  { path: "/mafia", Page: MafiaPage, metadata: mafiaMetadata, min: 4, max: 24 },
])("$path game metadata", ({ path, Page, metadata, min, max }) => {
  const playerRange = `${min}-${max}`;

  it("publishes the supported player range in rendered JSON-LD", () => {
    const { container } = render(<Page />);
    const scripts = container.querySelectorAll('script[type="application/ld+json"]');
    expect(scripts).toHaveLength(1);
    const data = JSON.parse(scripts[0]!.textContent!);

    expect(data).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Game",
      inLanguage: "bg-BG",
      numberOfPlayers: { "@type": "QuantitativeValue", minValue: min, maxValue: max },
    });
    expect(new URL(data.url).pathname).toBe(path);
    expect(data.description).toContain(`${playerRange} играчи`);
    expect(data.description).not.toMatch(/сървър|server|нощно гласуване/i);
  });

  it.each(["description", "openGraph", "twitter"] as const)("describes the game and player range in %s without stale jargon", (surface) => {
    const description = surface === "description" ? metadata.description : metadata[surface]?.description;
    expect(description).toContain(`${playerRange} играчи`);
    expect(description).not.toMatch(/сървър|server|нощно гласуване/i);
  });
});
