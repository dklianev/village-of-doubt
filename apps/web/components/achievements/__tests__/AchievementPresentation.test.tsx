import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ACHIEVEMENTS } from "@werewolf/shared";
import { AchievementsClient } from "@/components/achievements-client";
import { AchievementPlaque } from "../AchievementPlaque";
import { getAchievementCollection, type OwnedAchievement } from "../achievement-presentation";

const achievement = ACHIEVEMENTS[0]!;
const gameId = "00000000-0000-4000-8000-000000000001";
const unlockedAt = "2026-06-01T22:30:00.000Z";

afterEach(() => {
  vi.unstubAllEnvs();
  delete document.documentElement.dataset.theme;
});

function award(achievementId: string, date = unlockedAt): OwnedAchievement {
  return { achievementId, unlockedAt: date, gameId };
}

describe("achievement collection", () => {
  it.each([
    ["bronze", "Бронз"], ["silver", "Сребро"], ["gold", "Злато"],
  ] as const)("labels the %s tier independently of locked state", (tier, label) => {
    const { rerender } = render(<AchievementPlaque achievement={{ ...achievement, tier }} unlockedAt={null} />);
    expect(screen.getByText(label)).toBeVisible();
    expect(screen.getByText("Заключено")).toBeVisible();
    rerender(<AchievementPlaque achievement={{ ...achievement, tier }} unlockedAt={unlockedAt} />);
    expect(screen.getByText(label)).toBeVisible();
    expect(screen.getByText("Отключено")).toBeVisible();
  });

  it("counts only catalog awards and keeps one featured h2 above the collection's h3 items", () => {
    const { container } = render(<AchievementsClient status="ready" owned={[
      { achievementId: achievement.id, unlockedAt, gameId },
      { achievementId: "retired-achievement", unlockedAt, gameId },
    ]} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Легенди от масата");
    expect(screen.getByLabelText(`1 от ${ACHIEVEMENTS.length} легенди отключени`)).toHaveTextContent(`1 от ${ACHIEVEMENTS.length} отключени`);
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(2);
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(ACHIEVEMENTS.length - 1);
    expect(container.querySelector(".achievement-feature")).toHaveAttribute("data-achievement-id", achievement.id);
    expect(container.querySelectorAll(`[data-achievement-id="${achievement.id}"]`)).toHaveLength(1);
    expect(container.querySelectorAll("[data-achievement-id]")).toHaveLength(ACHIEVEMENTS.length);
  });

  it("shows a ready empty collection, not a failed or loading collection", () => {
    const { container } = render(<AchievementsClient status="ready" owned={[]} />);
    expect(screen.getByText(/Още нямаш отключена легенда/)).toBeInTheDocument();
    expect(container.querySelectorAll('[data-locked="true"]')).toHaveLength(ACHIEVEMENTS.length);
    expect(screen.getByLabelText(`0 от ${ACHIEVEMENTS.length} легенди отключени`)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Всички отличия" })).toBeInTheDocument();
    expect(container.querySelector(".achievement-feature")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("invites a ready empty collection to choose a game on the existing home route", () => {
    const { rerender } = render(<AchievementsClient status="ready" owned={[]} />);
    expect(screen.getByRole("link", { name: "Избери игра" })).toHaveAttribute("href", "/");
    rerender(<AchievementsClient status="ready" owned={[award("first_blood")]} />);
    expect(screen.queryByRole("link", { name: "Избери игра" })).toBeNull();
    rerender(<AchievementsClient status="unavailable" owned={[]} />);
    expect(screen.queryByRole("link", { name: "Избери игра" })).toBeNull();
    expect(screen.getByRole("link", { name: "Опитай отново" })).toBeInTheDocument();
  });

  it("counts a completed collection without inventing per-achievement progress", () => {
    const { container } = render(<AchievementsClient status="ready" owned={ACHIEVEMENTS.map(({ id }) => ({
      achievementId: id, unlockedAt, gameId,
    }))} />);
    expect(screen.getByLabelText(`${ACHIEVEMENTS.length} от ${ACHIEVEMENTS.length} легенди отключени`)).toBeInTheDocument();
    expect(container.querySelectorAll('[data-locked="false"]')).toHaveLength(ACHIEVEMENTS.length);
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("does not replace unavailable data with a false zero or locked collection and offers a document retry", () => {
    const { container } = render(<AchievementsClient status="unavailable" owned={[]} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Не успяхме да заредим легендите");
    expect(screen.getByRole("link", { name: "Опитай отново" })).toHaveAttribute("href", "/achievements");
    expect(container.querySelector(".achievement-progress")).toBeNull();
    expect(container.querySelector(".plaque-wall")).toBeNull();
    expect(container.querySelector(".achievement-feature")).toBeNull();
    expect(screen.queryByRole("group")).toBeNull();
  });

  it("uses Sofia's calendar date and exposes a semantic timestamp", () => {
    const { container } = render(<AchievementPlaque achievement={achievement} unlockedAt={unlockedAt} gameId={gameId} />);
    expect(container.querySelector("time")).toHaveAttribute("datetime", unlockedAt);
    expect(container.querySelector("time")).toHaveTextContent("2.06.2026");
    expect(screen.getByRole("link", { name: `Виж играта: ${achievement.titleBg}` })).toHaveAttribute("href", `/history/${gameId}/replay`);
  });

  it.each([null, "", "bad/id?visualReplay=fixture"])("handles absent or invalid game reference %s without an unsafe link", (id) => {
    render(<AchievementPlaque achievement={achievement} unlockedAt={unlockedAt} gameId={id} />);
    expect(screen.getByText("Отключено")).toBeInTheDocument();
    expect(screen.getByText("Записът не е достъпен")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("does not crash or invent a timestamp for an invalid legacy date", () => {
    const { container } = render(<AchievementPlaque achievement={achievement} unlockedAt="unknown" />);
    expect(screen.getByText("Отключено")).toBeInTheDocument();
    expect(container.querySelector("time")).toBeNull();
  });

  it("does not expose a replay for a locked item", () => {
    render(<AchievementPlaque achievement={achievement} unlockedAt={null} gameId={gameId} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Заключено")).toBeInTheDocument();
  });

  it("cannot add the visual replay bypass in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    render(<AchievementPlaque achievement={achievement} unlockedAt={unlockedAt} gameId={gameId} visualReplay />);
    expect(screen.getByRole("link")).toHaveAttribute("href", `/history/${gameId}/replay`);
  });

  it.each(["jester_win", "maniac_endgame", "hunter_revenge"])("features the newest actual award and its own art: %s", (id) => {
    const latest = ACHIEVEMENTS.find((item) => item.id === id)!;
    const owned = [award(id, "2026-06-03T12:00:00Z"), award("first_blood"), award("retired-achievement", "2099-01-01T00:00:00Z")];
    const { container, rerender } = render(<AchievementsClient status="ready" owned={owned} />);
    const assertFeatured = () => {
      const feature = screen.getByRole("article", { name: latest.titleBg });
      expect(feature).toHaveClass("achievement-feature");
      expect(feature).toHaveAttribute("data-tier", latest.tier);
      expect(feature).toHaveAttribute("data-locked", "false");
      expect(within(feature).getByText(latest.descriptionBg)).toBeInTheDocument();
      const image = feature.querySelector("img")!;
      expect(decodeURIComponent(image.getAttribute("src")!)).toContain(`/game-art/achievements/relics/${id}.webp`);
      expect(image).toHaveAttribute("alt", "");
      expect(image).toHaveAttribute("width", "960");
      expect(image).toHaveAttribute("height", "640");
      expect(image).toHaveAttribute("loading", "eager");
      expect(image).toHaveClass("achievement-feature-object");
      const companion = feature.querySelector(".achievement-feature-companion")!;
      expect(decodeURIComponent(companion.getAttribute("src")!)).toContain(`/game-art/achievements/relics/${id === "jester_win" ? "hunter_revenge" : "jester_win"}.webp`);
      expect(companion).toHaveAttribute("alt", "");
      expect(companion.parentElement).toHaveAttribute("aria-hidden", "true");
      expect(companion).toHaveAttribute("width", "960");
      expect(companion).toHaveAttribute("height", "640");
      expect(companion).toHaveAttribute("sizes", "(max-width: 639px) 90px, 260px");
      expect(companion).toHaveAttribute("loading", "eager");
      expect(companion).not.toHaveAttribute("fetchpriority", "high");
      expect(container.querySelector(`.plaque-wall [data-achievement-id="${id}"]`)).toBeNull();
      expect(container.querySelectorAll("[data-achievement-id]")).toHaveLength(ACHIEVEMENTS.length);
    };
    assertFeatured();
    rerender(<AchievementsClient status="ready" owned={[...owned].reverse()} />);
    assertFeatured();
  });

  it("orders by the actual instant, with catalog order resolving timestamp ties", () => {
    const owned = [
      award("jester_win", "2026-06-02T01:00:00+03:00"),
      award("first_blood", "2026-06-01T22:00:00Z"),
      award("hunter_revenge", "2026-06-02T00:30:00+03:00"),
    ];
    for (const rows of [owned, [...owned].reverse()]) {
      const result = getAchievementCollection(ACHIEVEMENTS, rows);
      expect(result.featured?.achievement.id).toBe("first_blood");
      expect(result.remaining.map(({ achievement: item }) => item.id)).toEqual(ACHIEVEMENTS.slice(1).map((item) => item.id));
    }
  });

  it("ignores an unknown-only collection without manufacturing a featured award or image", () => {
    const { container } = render(<AchievementsClient status="ready" owned={[award("unknown", "2099-01-01T00:00:00Z")]} />);
    expect(screen.getByLabelText(`0 от ${ACHIEVEMENTS.length} легенди отключени`)).toBeInTheDocument();
    expect(container.querySelector(".achievement-feature")).toBeNull();
    expect(container.innerHTML).not.toContain("unknown.webp");
    expect(screen.getByText(/Още нямаш отключена легенда/)).toBeInTheDocument();
  });

  it.each(["unknown", "", "2026-99-99", "Infinity"])("keeps an invalid legacy date %s owned, without a fake latest date", (date) => {
    const { container, rerender } = render(<AchievementsClient status="ready" owned={[award("hunter_revenge", date)]} />);
    expect(screen.getByLabelText(`1 от ${ACHIEVEMENTS.length} легенди отключени`)).toBeInTheDocument();
    expect(container.querySelector(".achievement-feature")).toBeNull();
    expect(container.querySelector("time")).toBeNull();
    expect(screen.getByText("Отключено")).toBeInTheDocument();
    expect(screen.queryByText(/Още нямаш отключена легенда/)).toBeNull();
    rerender(<AchievementsClient status="ready" owned={[award("first_blood"), award("hunter_revenge", date)]} />);
    expect(container.querySelector(".achievement-feature")).toHaveAttribute("data-achievement-id", "first_blood");
    expect(container.querySelector('.plaque-wall [data-achievement-id="hunter_revenge"]')).toHaveAttribute("data-locked", "false");
  });

  it("deduplicates awards, preferring a valid newest record without mutating the input", () => {
    const owned = [award("first_blood", "unknown"), award("first_blood"), award("first_blood", "2026-06-03T12:00:00Z")];
    const original = structuredClone(owned);
    const { container, rerender } = render(<AchievementsClient status="ready" owned={owned} />);
    expect(screen.getByLabelText(`1 от ${ACHIEVEMENTS.length} легенди отключени`)).toBeInTheDocument();
    expect(container.querySelectorAll('[data-achievement-id="first_blood"]')).toHaveLength(1);
    expect(container.querySelector("time")).toHaveAttribute("datetime", "2026-06-03T12:00:00.000Z");
    rerender(<AchievementsClient status="ready" owned={[...owned].reverse()} />);
    expect(container.querySelector("time")).toHaveAttribute("datetime", "2026-06-03T12:00:00.000Z");
    expect(owned).toEqual(original);
  });

  it("filters only the remaining awards, with pressed buttons and counts scoped to that collection", async () => {
    const user = userEvent.setup();
    const { container } = render(<AchievementsClient status="ready" owned={[
      award("hunter_revenge", "2026-06-03T12:00:00Z"), award("first_blood"), award("jester_win", "unknown"),
    ]} />);
    const feature = container.querySelector(".achievement-feature");
    const collection = screen.getByRole("region", { name: "Останалите отличия" });
    const group = within(collection).getByRole("group", { name: "Филтър за останалите отличия" });
    const all = within(group).getByRole("button", { name: "Всички (6)" });
    const unlocked = within(group).getByRole("button", { name: "Отключени (2)" });
    const locked = within(group).getByRole("button", { name: "Заключени (4)" });
    expect(all).toHaveAttribute("aria-pressed", "true");
    expect(unlocked).toHaveAttribute("aria-pressed", "false");
    expect(document.getElementById(all.getAttribute("aria-controls")!)).toBeInTheDocument();
    await user.click(unlocked);
    expect(unlocked).toHaveAttribute("aria-pressed", "true");
    expect(all).toHaveAttribute("aria-pressed", "false");
    expect(within(collection).getAllByRole("article")).toHaveLength(2);
    expect(collection.querySelector('[data-locked="true"]')).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Показани: 2 от 6 останали отличия");
    locked.focus();
    await user.keyboard("{Enter}");
    expect(locked).toHaveAttribute("aria-pressed", "true");
    expect(within(collection).getAllByRole("article")).toHaveLength(4);
    expect(collection.querySelector('[data-locked="false"]')).toBeNull();
    expect(container.querySelector(".achievement-feature")).toBe(feature);
    expect(screen.getByLabelText(`3 от ${ACHIEVEMENTS.length} легенди отключени`)).toBeInTheDocument();
    await user.click(all);
    expect(within(collection).getAllByRole("article")).toHaveLength(6);
    expect(collection.querySelector('[data-achievement-id="hunter_revenge"]')).toBeNull();
  });

  it("loads the first visible relic eagerly without eagerly loading the whole collection", () => {
    const { container } = render(<AchievementsClient status="ready" owned={[]} />);
    const images = container.querySelectorAll(".achievement-plaque-art img");
    expect(images[0]).toHaveAttribute("loading", "eager");
    for (const image of [...images].slice(1)) expect(image).toHaveAttribute("loading", "lazy");
  });

  it("shows an empty unlocked filter for zero owned and restores the locked catalog", async () => {
    const user = userEvent.setup();
    render(<AchievementsClient status="ready" owned={[]} />);
    await user.click(screen.getByRole("button", { name: "Отключени (0)" }));
    expect(screen.getByText("Няма отключени отличия.")).toBeInTheDocument();
    expect(screen.queryByRole("article")).toBeNull();
    await user.click(screen.getByRole("button", { name: `Заключени (${ACHIEVEMENTS.length})` }));
    expect(screen.getAllByRole("article")).toHaveLength(ACHIEVEMENTS.length);
  });

  it("keeps the only owned award featured when the remaining unlocked filter is empty", async () => {
    const user = userEvent.setup();
    const { container } = render(<AchievementsClient status="ready" owned={[award("first_blood")]} />);
    await user.click(screen.getByRole("button", { name: "Отключени (0)" }));
    expect(screen.getByText("Няма други отключени отличия.")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(container.querySelector(".achievement-feature")).toBeInTheDocument();
  });

  it("shows an empty locked filter for all owned without losing the featured award", async () => {
    const user = userEvent.setup();
    const { container } = render(<AchievementsClient status="ready" owned={ACHIEVEMENTS.map(({ id }) => award(id))} />);
    await user.click(screen.getByRole("button", { name: "Заключени (0)" }));
    expect(screen.getByText("Няма заключени отличия.")).toBeInTheDocument();
    expect(container.querySelectorAll(".achievement-plaque")).toHaveLength(0);
    expect(container.querySelector(".achievement-feature")).toBeInTheDocument();
    expect(screen.getByLabelText(`${ACHIEVEMENTS.length} от ${ACHIEVEMENTS.length} легенди отключени`)).toBeInTheDocument();
  });

  it("suppresses stale supplied awards, count and filters when the collection is unavailable", () => {
    const { container } = render(<AchievementsClient status="unavailable" owned={[award("first_blood")]} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(container.querySelector(".achievement-progress")).toBeNull();
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.queryByRole("group")).toBeNull();
  });

  it.each([null, "", "javascript:alert(1)", "../other", `${gameId}?visualReplay=fixture`, "00000000-0000-0000-0000-000000000001"])("keeps an unsafe or unavailable featured replay %s unlinked", (id) => {
    render(<AchievementsClient status="ready" owned={[{ ...award("first_blood"), gameId: id }]} visualReplay />);
    expect(screen.getByText("Записът не е достъпен")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Виж играта:/ })).toBeNull();
  });

  it.each([
    ["production", true, ""], ["production", false, ""],
    ["development", true, "?visualReplay=fixture"], ["development", false, ""],
  ] as const)("keeps featured and gallery replays safe in %s, visual=%s", (env, visualReplay, suffix) => {
    vi.stubEnv("NODE_ENV", env);
    render(<AchievementsClient status="ready" owned={[award("first_blood"), award("jester_win", "2026-06-03T12:00:00Z")]} visualReplay={visualReplay} />);
    const links = screen.getAllByRole("link", { name: /Виж играта:/ });
    expect(links).toHaveLength(2);
    for (const link of links) expect(link).toHaveAttribute("href", `/history/${gameId}/replay${suffix}`);
  });

  it.each([
    ["werewolves", "Върколак"], ["mafia", "Мафия"], ["universal", "Двата свята"],
  ] as const)("uses the catalog's real family label %s", (family, label) => {
    render(<AchievementPlaque achievement={{ ...achievement, family }} unlockedAt={null} headingLevel={3} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(achievement.titleBg);
  });

  it("keeps the same actual catalog, metadata, status, timestamps and replays in light and dark", () => {
    const owned = [award("hunter_revenge", "2026-06-03T12:00:00Z"), award("first_blood")];
    document.documentElement.dataset.theme = "light";
    const { container, rerender } = render(<AchievementsClient status="ready" owned={owned} />);
    const markup = container.innerHTML;
    const feature = screen.getByRole("article", { name: "Последният изстрел" });
    expect(within(feature).getByText("Върколак")).toBeInTheDocument();
    expect(within(feature).getByText("Злато")).toBeInTheDocument();
    expect(feature.querySelector("time")).toHaveAttribute("datetime", "2026-06-03T12:00:00.000Z");
    document.documentElement.dataset.theme = "dark";
    rerender(<AchievementsClient status="ready" owned={owned} />);
    expect(container.innerHTML).toBe(markup);
  });

  it("renders decorative native 3:2 gallery images with bounded responsive sizes and adjacent headings", () => {
    const { container } = render(<AchievementsClient status="ready" owned={[]} />);
    for (const [index, item] of ACHIEVEMENTS.entries()) {
      const plaque = screen.getByRole("article", { name: item.titleBg });
      const image = plaque.querySelector("img")!;
      expect(image).toHaveAttribute("alt", "");
      expect(image).toHaveAttribute("width", "960");
      expect(image).toHaveAttribute("height", "640");
      expect(image).toHaveAttribute("loading", index === 0 ? "eager" : "lazy");
      expect(image.getAttribute("sizes")).toContain("560px");
      expect(image.getAttribute("sizes")).not.toContain("100vw");
      expect(decodeURIComponent(image.getAttribute("src")!)).toContain(`/game-art/achievements/relics/${item.id}.webp`);
      expect(within(plaque).getByRole("heading", { level: 3 })).toHaveTextContent(item.titleBg);
      expect(within(plaque).getByText(item.descriptionBg)).toBeInTheDocument();
    }
    expect(container.querySelectorAll("img")).toHaveLength(ACHIEVEMENTS.length);
  });
});
