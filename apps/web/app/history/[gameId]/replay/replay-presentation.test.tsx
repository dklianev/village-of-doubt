import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReplayPage from "./page";

const replayPath = "/history/fixture-game-1/replay?visualReplay=fixture";
const originalScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
let frames: FrameRequestCallback[];

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, writable: true, value: vi.fn() });
  window.history.replaceState(null, "", replayPath);
  frames = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => frames.push(callback));
});

afterEach(() => {
  window.history.replaceState(null, "", replayPath);
  if (originalScrollIntoView) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", originalScrollIntoView);
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});

async function renderFixture(visualReplay = "fixture") {
  return render(await ReplayPage({
    params: Promise.resolve({ gameId: "fixture-game-1" }),
    searchParams: Promise.resolve({ visualReplay }),
  }));
}

function chapterIndex() {
  return screen.getByRole("navigation", { name: "Фази в тази част" });
}

function expectSelectedChapter(id: string, linkName: string) {
  const visible = document.querySelectorAll("[data-replay-chapter]:not([hidden])");
  expect(visible).toHaveLength(1);
  expect(visible[0]).toHaveAttribute("id", id);
  expect(visible[0]).toBeVisible();
  expect(within(chapterIndex()).getByRole("link", { current: "location" }))
    .toBe(within(chapterIndex()).getByRole("link", { name: linkName }));
}

function selectChapter(label: string) {
  fireEvent.click(within(chapterIndex()).getByRole("link", { name: label }));
  act(() => {
    for (const callback of frames.splice(0)) callback(0);
  });
}

async function traverseHistory(direction: "back" | "forward") {
  await act(async () => {
    await new Promise<void>((resolve) => {
      window.addEventListener("popstate", () => resolve(), { once: true });
      window.history[direction]();
    });
  });
}

describe("replay presentation", () => {
  it("keeps the numeric case reference and makes the roster available without opening a disclosure", async () => {
    const view = await ReplayPage({
      params: Promise.resolve({ gameId: "fixture-game-1" }),
      searchParams: Promise.resolve({ visualReplay: "fixture" }),
    });
    const { container } = render(view);

    expect(container).toHaveTextContent(/дело №\d{4,}/i);
    const headline = screen.getByRole("heading", { level: 1, name: "Селото оцеля." });
    expect(headline).toBeVisible();
    const hero = within(headline.closest("header")!);
    expect(hero.getByText("Последният глас сложи край на вечерта.", { selector: "p" })).toBeVisible();
    expect(hero.queryByRole("heading", { level: 2 })).toBeNull();
    expect(screen.getByRole("navigation", { name: "Фази в тази част" })).toBeInTheDocument();
    const roster = screen.getByRole("complementary", { name: "Участници в записа" });
    for (const name of ["Анна", "Борис", "Рада"]) {
      expect(within(roster).getByText(name, { exact: true })).toBeVisible();
    }
    expect(screen.getByText("Анна гласува за Борис.")).toBeInTheDocument();
  });

  it("defaults to the final chapter while keeping all eight events and their phase anchors mounted", async () => {
    const { container } = await renderFixture();
    const timeline = screen.getByRole("region", { name: "Хронология на играта" });
    const links = within(chapterIndex()).getAllByRole("link");

    expect(links.map((link) => link.textContent)).toEqual(["Начало", "Нощ 1", "Ден 2", "Край"]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["#chapter-1", "#chapter-2", "#chapter-3", "#phase-7"]);
    expectSelectedChapter("chapter-3", "Ден 2");
    expect(within(timeline).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(["Ден 2"]);
    expect(within(timeline).getAllByRole("heading", { level: 4, hidden: true }).map((heading) => heading.textContent))
      .toEqual(["Начало на играта", "Нощно действие", "Гласуване", "Смяна на фаза", "Гласуване", "Преброяване", "Борис е елиминиран.", "Селото печели"]);
    expect(within(timeline).getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent))
      .toEqual(["Гласуване", "Смяна на фаза", "Гласуване", "Преброяване", "Борис е елиминиран.", "Селото печели"]);
    expect(screen.getByText("Начало на играта")).not.toBeVisible();
    expect(screen.getByText("Нощно действие")).not.toBeVisible();
    expect(timeline.querySelectorAll("[data-replay-event]")).toHaveLength(8);
    expect(Array.from(timeline.querySelectorAll("[data-replay-phase]"), (phase) => phase.id))
      .toEqual(["phase-1", "phase-2", "phase-3", "phase-4", "phase-5", "phase-6", "phase-7"]);
    const ids = Array.from(container.querySelectorAll("[id]"), (element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("selects Start, Night and Day independently without unmounting other chapters", async () => {
    const { container } = await renderFixture();
    const events = Array.from(container.querySelectorAll("[data-replay-event]"));

    for (const [label, id, eventCount] of [
      ["Начало", "chapter-1", 1], ["Нощ 1", "chapter-2", 1], ["Ден 2", "chapter-3", 6],
    ] as const) {
      selectChapter(label);

      expectSelectedChapter(id, label);
      expect(window.location.hash).toBe(`#${id}`);
      expect(document.getElementById(id)).toHaveFocus();
      expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(eventCount);
      const mounted = Array.from(container.querySelectorAll("[data-replay-event]"));
      expect(mounted).toHaveLength(8);
      mounted.forEach((event, index) => expect(event).toBe(events[index]));
      for (const chapter of container.querySelectorAll("[data-replay-chapter]")) {
        if (chapter.id !== id) expect(chapter).not.toBeVisible();
      }
    }
  });

  it("keeps voting, pause and resumed voting in chronological order within Day 2", async () => {
    await renderFixture();
    const day = screen.getByRole("region", { name: "Ден 2" });

    expect(Array.from(day.querySelectorAll("[data-replay-phase]"), (phase) => [phase.id, phase.getAttribute("aria-label")]))
      .toEqual([["phase-3", "Гласуване"], ["phase-4", "Пауза"], ["phase-5", "Гласуване"], ["phase-6", "Развръзка"], ["phase-7", "Край"]]);
    expect(within(document.getElementById("phase-3")!).getByText("Анна гласува за Борис.")).toBeVisible();
    expect(within(document.getElementById("phase-4")!).getByText("Започва пауза.")).toBeVisible();
    expect(within(document.getElementById("phase-5")!).getByText("Рада гласува за Борис.")).toBeVisible();
    expect(within(day).getAllByRole("heading", { level: 4 })).toHaveLength(6);
  });

  it("selects the first chapter when the page has more events", async () => {
    const { container } = await renderFixture("long");

    expectSelectedChapter("chapter-1", "Ден 1");
    expect(container.querySelectorAll("[data-replay-chapter]")).toHaveLength(10);
    expect(container.querySelectorAll("[data-replay-event]")).toHaveLength(200);
    expect(screen.getAllByRole("heading", { level: 4 })).toHaveLength(20);
    expect(screen.getByRole("link", { name: "Следващи събития" })).toBeVisible();
    expect(within(chapterIndex()).queryByRole("link", { name: "Край" })).toBeNull();
  });

  it.each(["Край", "Към развръзката"])("opens the final phase from %s and marks only its index link current", async (linkName) => {
    await renderFixture();
    const finale = document.getElementById("phase-7")!;
    finale.scrollIntoView = vi.fn();
    selectChapter("Начало");
    expect(finale).not.toBeVisible();
    const link = screen.getByRole("link", { name: linkName });
    expect(link).toHaveAttribute("href", "#phase-7");

    fireEvent.click(link);
    act(() => { for (const callback of frames.splice(0)) callback(0); });

    expectSelectedChapter("chapter-3", "Край");
    expect(window.location.hash).toBe("#phase-7");
    expect(finale).toBeVisible();
    expect(finale).toHaveFocus();
    expect(finale.scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    expect(screen.getByText("Борис е елиминиран.")).toBeVisible();
    expect(screen.getByText("Играта приключи.")).toBeVisible();
  });

  it.each([
    ["chapter-1", "chapter-1", "Начало"], ["chapter-2", "chapter-2", "Нощ 1"],
    ["phase-1", "chapter-1", "Начало"], ["phase-2", "chapter-2", "Нощ 1"],
    ["phase-4", "chapter-3", "Ден 2"], ["phase-5", "chapter-3", "Ден 2"], ["phase-7", "chapter-3", "Край"],
  ])("restores a direct #%s link without creating a history entry", async (target, chapter, label) => {
    window.history.replaceState(null, "", `${replayPath}#${target}`);
    const push = vi.spyOn(window.history, "pushState");

    await renderFixture();

    expectSelectedChapter(chapter, label);
    expect(document.getElementById(target)).toBeVisible();
    expect(window.location.hash).toBe(`#${target}`);
    expect(push).not.toHaveBeenCalled();
  });

  it("restores chapter selection on Back and Forward, including the no-hash default", async () => {
    await renderFixture();
    selectChapter("Начало");
    selectChapter("Нощ 1");

    await traverseHistory("back");
    expect(window.location.hash).toBe("#chapter-1");
    expectSelectedChapter("chapter-1", "Начало");

    await traverseHistory("back");
    expect(window.location.hash).toBe("");
    expectSelectedChapter("chapter-3", "Ден 2");

    await traverseHistory("forward");
    expect(window.location.hash).toBe("#chapter-1");
    expectSelectedChapter("chapter-1", "Начало");
  });

  it("responds to hash changes and falls back to the default for a missing target", async () => {
    await renderFixture();
    const push = vi.spyOn(window.history, "pushState");
    window.history.replaceState(null, "", `${replayPath}#phase-2`);
    fireEvent(window, new HashChangeEvent("hashchange"));
    expectSelectedChapter("chapter-2", "Нощ 1");

    window.history.replaceState(null, "", `${replayPath}#phase-999`);
    fireEvent(window, new HashChangeEvent("hashchange"));
    expectSelectedChapter("chapter-3", "Ден 2");
    expect(push).not.toHaveBeenCalled();
  });

  it("keeps private events and role portraits out of every mounted public chapter", async () => {
    const { container } = await renderFixture("public");
    const timeline = screen.getByRole("region", { name: "Хронология на играта" });
    const roster = screen.getByRole("complementary", { name: "Участници в записа" });

    expect(screen.getByText("Публичен запис")).toBeVisible();
    expect(timeline.querySelectorAll("[data-replay-event]")).toHaveLength(5);
    expect(within(timeline).queryByText("Начало на играта")).toBeNull();
    expect(within(timeline).queryByText("Нощно действие")).toBeNull();
    expect(within(timeline).queryByText("Преброяване")).toBeNull();
    expect(within(roster).getAllByText("Ролята не е показана")).toHaveLength(3);
    for (const portrait of roster.querySelectorAll("img")) {
      expect(portrait).toHaveAttribute("src", "/game-art/thumbs/card-back-secret.webp");
    }
    expect(container.innerHTML).not.toMatch(/assignments|check_alignment|totalVotes/);
  });

  it("renders Bulgarian fallbacks for unknown stored codes without exposing the raw values", async () => {
    const view = await ReplayPage({
      params: Promise.resolve({ gameId: "fixture-game-unknown" }),
      searchParams: Promise.resolve({ visualReplay: "unknown-codes" }),
    });
    const { container } = render(view);

    expect(container).toHaveTextContent("Неизвестна фаза");
    expect(container).toHaveTextContent("Друго събитие");
    expect(container).toHaveTextContent("неуточнена видимост");
    expect(container).toHaveTextContent("Неизвестна роля");
    expect(container.textContent).not.toMatch(/future_(winner|phase|event|visibility|role|payload)/);
    expect(decodeURIComponent(container.innerHTML)).not.toMatch(/future_(winner|phase|event|visibility|role|payload)/);
  });
});
