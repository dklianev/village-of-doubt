import { render, screen, within } from "@testing-library/react";
import { ACHIEVEMENTS } from "@werewolf/shared";
import { describe, expect, it } from "vitest";
import { AccountAchievements } from "../AccountAchievements";

const total = ACHIEVEMENTS.length;

function relicSources(container: HTMLElement) {
  return Array.from(container.querySelectorAll("img"), (image) => {
    const source = new URL(image.getAttribute("src") ?? "", "http://localhost");
    return source.searchParams.get("url") ?? source.pathname;
  });
}

describe("AccountAchievements", () => {
  it.each(ACHIEVEMENTS)("renders the owned $id relic with its catalog title", ({ id, titleBg }) => {
    const { container } = render(<AccountAchievements unlockedIds={[id]} total={total} />);

    expect(relicSources(container)).toEqual([`/game-art/achievements/relics/${id}.webp`]);
    expect(container.querySelector("img")).toBeVisible();
    expect(screen.getByText(titleBg)).toBeVisible();
    expect(screen.getByText(`1 от ${total} легенди отключени.`)).toBeVisible();
    expect(container.querySelector("[data-account-empty-legends]")).not.toBeInTheDocument();
  });

  it.each([
    { name: "duplicate awards", ids: ["first_blood", "first_blood", "jester_win", "jester_win"] },
    { name: "stale IDs", ids: ["retired-achievement", "jester_win", "first_blood", "unknown-achievement"] },
    { name: "duplicate awards mixed with stale IDs", ids: ["first_blood", "retired-achievement", "jester_win", "first_blood", "retired-achievement"] },
  ])("counts and renders only unique known awards for $name", ({ ids }) => {
    const originalIds = [...ids];
    const { container } = render(<AccountAchievements unlockedIds={ids} total={total} />);

    expect(screen.getByText(`2 от ${total} легенди отключени.`)).toBeVisible();
    expect(relicSources(container).sort()).toEqual([
      "/game-art/achievements/relics/first_blood.webp",
      "/game-art/achievements/relics/jester_win.webp",
    ]);
    expect(screen.getAllByText("Първа кръв")).toHaveLength(1);
    expect(screen.getAllByText("Шут на годината")).toHaveLength(1);
    expect(screen.queryByText(/retired-achievement|unknown-achievement/)).not.toBeInTheDocument();
    const remainder = screen.getAllByText(`Още ${total - 2} легенди чакат своята вечер.`);
    expect(remainder).toHaveLength(1);
    expect(remainder[0]).toBeVisible();
    expect(container.querySelector("[data-account-locked-legend]")).not.toBeInTheDocument();
    expect(ids).toEqual(originalIds);
  });

  it.each([
    { name: "no awards", ids: [] },
    { name: "only stale awards", ids: ["retired-achievement", "unknown-achievement", "retired-achievement"] },
  ])("keeps $name empty and labels the guardian relic as a locked preview, not an award", ({ ids }) => {
    const { container } = render(<AccountAchievements unlockedIds={ids} total={total} />);

    expect(container.querySelector("[data-account-empty-legends]")).toBeInTheDocument();
    expect(screen.getByText(`0 от ${total} легенди отключени.`)).toBeVisible();
    expect(screen.getByText("Легендите още не са започнали.")).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: "Легенди" })).toBeVisible();
    const catalogLink = screen.getByRole("link", { name: /Разгледай легендите/ });
    expect(catalogLink).toBeVisible();
    expect(catalogLink).toHaveAttribute("href", "/achievements");

    expect(relicSources(container)).toEqual(["/game-art/achievements/relics/guardian_save.webp"]);
    const preview = screen.getByRole("img", { name: "Заключена легенда: Спасител" });
    expect(preview.querySelector("img")).toBeVisible();
    expect(within(preview).getByText("Заключена")).toBeVisible();
    expect(screen.queryByRole("list", { name: "Спечелени легенди" })).not.toBeInTheDocument();
    expect(container.querySelectorAll("[data-account-locked-legend]").length).toBeLessThanOrEqual(1);
    expect(screen.queryAllByLabelText(/Заключена легенда/i).length).toBeLessThanOrEqual(1);
  });

  it("counts owned awards beyond the preview and summarizes a single remaining legend", () => {
    const ids = ACHIEVEMENTS.slice(0, -1).map(({ id }) => id);
    const { container } = render(<AccountAchievements unlockedIds={[...ids, ids[0]!, "retired-achievement"]} total={total} />);

    expect(screen.getByText(`${ids.length} от ${total} легенди отключени.`)).toBeVisible();
    const remainder = screen.getAllByText("Още една легенда чака своята вечер.");
    expect(remainder).toHaveLength(1);
    expect(remainder[0]).toBeVisible();
    expect(container.querySelector("[data-account-locked-legend]")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Виж всички легенди/ })).toHaveAttribute("href", "/achievements");
  });

  it("does not show a locked remainder or preview for a fully owned catalog", () => {
    const ids = ACHIEVEMENTS.map(({ id }) => id);
    const { container } = render(<AccountAchievements unlockedIds={[...ids, ids[0]!, "retired-achievement"]} total={total} />);

    expect(screen.getByText(`${total} от ${total} легенди отключени.`)).toBeVisible();
    const sources = relicSources(container);
    const ownedSources = ids.map((id) => `/game-art/achievements/relics/${id}.webp`);
    expect(sources.length).toBeGreaterThan(0);
    expect(new Set(sources).size).toBe(sources.length);
    for (const source of sources) expect(ownedSources).toContain(source);
    expect(container.querySelector("[data-account-empty-legends]")).not.toBeInTheDocument();
    expect(container.querySelector("[data-account-locked-legend]")).not.toBeInTheDocument();
    expect(screen.queryByText(/заключен/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/заключен/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/легенд[аи] чака/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Виж всички легенди/ })).toHaveAttribute("href", "/achievements");
  });
});
