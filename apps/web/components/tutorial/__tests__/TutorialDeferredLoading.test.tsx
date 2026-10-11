import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TutorialFlipbook } from "../TutorialFlipbook";
import { TutorialDeferredSlide } from "../TutorialDeferredSlide";
import { loadTutorialDeferredSlide } from "../tutorial-deferred";

vi.mock("../tutorial-deferred", () => ({ loadTutorialDeferredSlide: vi.fn() }));
vi.mock("next/navigation", async () => {
  const { useMemo, useSyncExternalStore } = await import("react");
  const subscribe = (callback: () => void) => {
    window.addEventListener("popstate", callback);
    return () => window.removeEventListener("popstate", callback);
  };
  return { useSearchParams: () => {
    const query = useSyncExternalStore(subscribe, () => window.location.search);
    return useMemo(() => new URLSearchParams(query), [query]);
  } };
});

function deferred() {
  let resolve!: (scene: typeof TutorialDeferredSlide) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<typeof TutorialDeferredSlide>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function mount(query = "step=1") {
  window.history.replaceState(null, "", `/tutorial?${query}`);
  return render(<TutorialFlipbook setupScenes={{
    werewolves_classic: <h1>Werewolf setup from RSC</h1>,
    mafia_free: <h1>Mafia setup from RSC</h1>,
    mafia_sport: <h1>Sport setup from RSC</h1>,
  }} />);
}

describe("tutorial deferred loading", () => {
  beforeEach(() => {
    vi.mocked(loadTutorialDeferredSlide).mockReset();
    window.localStorage.clear();
    for (const method of ["replaceState", "pushState"] as const) {
      const original = window.history[method].bind(window.history);
      vi.spyOn(window.history, method).mockImplementation((data, unused, url) => {
        original(data, unused, url);
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
    }
  });

  it("defers fetching until requested, preserves controls and stage height, and ignores a cancelled load", async () => {
    const pending = deferred();
    vi.mocked(loadTutorialDeferredSlide).mockReturnValue(pending.promise);
    const user = userEvent.setup();
    const { container } = mount();
    expect(loadTutorialDeferredSlide).not.toHaveBeenCalled();
    const stage = screen.getByRole("region", { name: "Сцена 1: Събиране" });
    vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({ height: 736 } as DOMRect);
    const edition = screen.getByRole("combobox", { name: "Игра" });
    const progress = screen.getByRole("navigation", { name: "Ход на репетицията" });
    const navigation = screen.getByRole("navigation", { name: "Навигация между сцените" });

    await user.click(screen.getByRole("button", { name: "Следваща сцена" }));
    expect(loadTutorialDeferredSlide).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("region", { name: "Сцена 2: Нощ" })).toBe(stage);
    expect(within(stage).getByRole("status")).toHaveTextContent("Зареждаме сцената...");
    expect(container.querySelector(".tutorial-scene-loading")).toHaveStyle({ minHeight: "736px" });
    expect(screen.getByRole("combobox", { name: "Игра" })).toBe(edition);
    expect(edition).toBeEnabled();
    expect(screen.getByRole("navigation", { name: "Ход на репетицията" })).toBe(progress);
    expect(screen.getByRole("navigation", { name: "Навигация между сцените" })).toBe(navigation);
    expect(screen.getByRole("button", { name: /2\. Нощ/ })).toHaveAttribute("aria-current", "step");

    await user.click(screen.getByRole("button", { name: "Предишна сцена" }));
    await act(async () => pending.resolve(TutorialDeferredSlide));
    expect(screen.getByRole("heading", { name: "Werewolf setup from RSC" })).toBeVisible();
    expect(screen.queryByText("Очите се затварят.")).not.toBeInTheDocument();
  });

  it("reimports after repeated failures without losing practice, invitation, geometry or focus", async () => {
    const first = deferred();
    const second = deferred();
    const third = deferred();
    vi.mocked(loadTutorialDeferredSlide).mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise).mockReturnValueOnce(third.promise);
    const practice = { night: "boris", vote: "galya", visited: ["anna"] };
    localStorage.setItem("tutorial-practice-v1:mafia_sport", JSON.stringify(practice));
    const invite = "/mafia/join/ABC123?from=friend#invite";
    const user = userEvent.setup();
    mount(`game=mafia_sport&step=1&redirect=${encodeURIComponent(invite)}#lesson`);
    const stage = screen.getByRole("region", { name: "Сцена 1: Събиране" });
    vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({ height: 680 } as DOMRect);
    await user.click(screen.getByRole("button", { name: "Следваща сцена" }));
    await act(async () => first.reject(new Error("chunk failed")));
    expect(within(stage).getByRole("alert")).toHaveTextContent("Сцената не се зареди.");
    expect(screen.getByRole("button", { name: "Презареди страницата" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "Към поканата" })).toHaveAttribute("href", invite);
    expect(screen.getByRole("combobox", { name: "Игра" })).toHaveValue("mafia_sport");

    await user.click(screen.getByRole("button", { name: "Опитай отново" }));
    expect(stage).toHaveFocus();
    expect(within(stage).getByRole("status")).toHaveTextContent("Зареждаме сцената...");
    expect(stage.firstElementChild).toHaveStyle({ minHeight: "680px" });
    await act(async () => second.reject(new Error("still offline")));
    await user.click(screen.getByRole("button", { name: "Опитай отново" }));
    await act(async () => third.resolve(TutorialDeferredSlide));

    expect(loadTutorialDeferredSlide).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("heading", { name: "Очите се затварят." })).toBeVisible();
    expect(screen.getByRole("radio", { name: "Борис" })).toBeChecked();
    expect(within(stage).getByRole("status")).toHaveTextContent("Борис е от Мафията.");
    expect(stage).toHaveFocus();
    expect(JSON.parse(localStorage.getItem("tutorial-practice-v1:mafia_sport")!)).toEqual(practice);
    expect(window.location.hash).toBe("#lesson");
    await user.click(screen.getByRole("button", { name: /6\. Начало/ }));
    expect(screen.getByRole("link", { name: "Продължи към поканата" })).toHaveAttribute("href", invite);
    expect(loadTutorialDeferredSlide).toHaveBeenCalledTimes(3);
  });

  it("renders the latest requested scene when navigation continues during loading", async () => {
    const pending = deferred();
    vi.mocked(loadTutorialDeferredSlide).mockReturnValue(pending.promise);
    const user = userEvent.setup();
    mount("step=2");
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByText("Зареждаме сцената...")).toHaveAttribute("role", "status");
    await user.click(screen.getByRole("button", { name: /4\. Глас/ }));
    await act(async () => pending.resolve(TutorialDeferredSlide));
    expect(screen.getByRole("heading", { name: "Гласът оставя следа." })).toBeVisible();
    expect(loadTutorialDeferredSlide).toHaveBeenCalledTimes(1);
  });

  it("ignores an old mode's rejection and uses the new mode's practice", async () => {
    const oldMode = deferred();
    const newMode = deferred();
    vi.mocked(loadTutorialDeferredSlide).mockReturnValueOnce(oldMode.promise).mockReturnValueOnce(newMode.promise);
    localStorage.setItem("tutorial-practice-v1:mafia_free", JSON.stringify({ night: "anna", vote: null, visited: [] }));
    const user = userEvent.setup();
    mount("step=2&game=werewolves_classic");
    await user.selectOptions(screen.getByRole("combobox", { name: "Игра" }), "mafia_free");
    await act(async () => oldMode.reject(new Error("old mode failed")));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await act(async () => newMode.resolve(TutorialDeferredSlide));
    expect(screen.getByRole("radio", { name: "Анна" })).toBeChecked();
    expect(screen.getByText("Анна не е от Мафията.")).toBeVisible();
  });
});
