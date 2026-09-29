import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TutorialFlipbook as Flipbook } from "../TutorialFlipbook";
import { SlideSetup } from "../SlideSetup";
import { TUTORIAL_MODES } from "../tutorial-scenario";

function TutorialFlipbook() {
  return <Flipbook setupScenes={{
    werewolves_classic: <SlideSetup mode="werewolves_classic" />,
    mafia_free: <SlideSetup mode="mafia_free" />,
    mafia_sport: <SlideSetup mode="mafia_sport" />,
  }} />;
}

vi.mock("next/navigation", async () => {
  const { useMemo, useSyncExternalStore } = await import("react");
  const subscribe = (callback: () => void) => {
    window.addEventListener("popstate", callback);
    return () => window.removeEventListener("popstate", callback);
  };
  return {
    useSearchParams: () => {
      const query = useSyncExternalStore(subscribe, () => window.location.search);
      return useMemo(() => new URLSearchParams(query), [query]);
    },
  };
});

function navigate(params: Record<string, string>, hash = "") {
  window.history.replaceState(null, "", `/tutorial?${new URLSearchParams(params)}${hash}`);
}

const storedValues = new Map<string, string>();

Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: {
    clear: () => storedValues.clear(),
    getItem: (key: string) => storedValues.get(key) ?? null,
    removeItem: (key: string) => storedValues.delete(key),
    setItem: (key: string, value: string) => storedValues.set(key, value),
  },
});

describe("TutorialFlipbook", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState(null, "", "/tutorial");
    const replace = window.history.replaceState.bind(window.history);
    // Next's native-history integration notifies useSearchParams subscribers.
    vi.spyOn(window.history, "replaceState").mockImplementation((data, unused, url) => {
      replace(data, unused, url);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    const push = window.history.pushState.bind(window.history);
    vi.spyOn(window.history, "pushState").mockImplementation((data, unused, url) => {
      push(data, unused, url);
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
  });

  it("presents the six rehearsal scenes as an accessible progress rail", () => {
    const { container } = render(<TutorialFlipbook />);

    const progress = screen.getByRole("navigation", { name: "Ход на репетицията" });
    expect(progress).toBeInTheDocument();

    for (const label of ["Събиране", "Нощ", "Ден", "Глас", "Развръзка", "Начало"]) {
      expect(screen.getByRole("button", { name: new RegExp(label) })).toBeInTheDocument();
    }

    expect(screen.getByRole("button", { name: /Събиране/ })).toHaveAttribute("aria-current", "step");
    expect(screen.queryByRole("link", { name: "Продължи към игра" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Масата се събира." })).toBeInTheDocument();
    expect(container.querySelector(".tutorial-slide-copy")).toContainElement(
      screen.getByRole("heading", { level: 1, name: "Масата се събира." }),
    );
  });

  it("moves through the rehearsal while keeping the stage and controls in sync", async () => {
    const user = userEvent.setup();
    const { container } = render(<TutorialFlipbook />);

    const back = screen.getByRole("button", { name: "Предишна сцена" });
    expect(back).toBeDisabled();
    expect(container.querySelector('[data-tutorial-scene="setup"]')).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Следваща сцена" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Очите се затварят." })).toBeInTheDocument();
    const nightStage = container.querySelector('[data-tutorial-scene="night"]');
    expect(nightStage).toBeInTheDocument();
    expect(nightStage).toHaveFocus();
    expect(screen.getByText("Сцена 2 от 6: Нощ")).toHaveAttribute("role", "status");
    expect(screen.getByRole("button", { name: /Нощ/ })).toHaveAttribute("aria-current", "step");
    expect(back).toBeEnabled();
  });

  it.each([
    ["werewolves_classic", "werewolf", "Върколак", "/werewolf/create"],
    ["mafia_free", "mafia", "Мафия", "/mafia/create"],
    ["mafia_sport", "mafia", "Мафия", "/mafia/create?mode=mafia_sport"],
  ])("keeps final %s destinations in the selected family", async (game, family, label, create) => {
    const user = userEvent.setup();
    navigate({ game });
    render(<TutorialFlipbook />);

    await user.click(screen.getByRole("button", { name: /Начало/ }));

    const createLink = await screen.findByRole("link", { name: "Създай стая" });
    expect(createLink).toHaveAttribute("href", create);
    expect(screen.getByRole("link", { name: "Имам код" })).toHaveAttribute("href", `/${family}/join`);
    expect(screen.getByRole("link", { name: `Ролите ${family === "mafia" ? "в" : "във"} ${label}` })).toHaveAttribute("href", `/${family}/roles`);
    expect(screen.getByRole("link", { name: `Правила за ${label}` })).toHaveAttribute("href", `/${family}/rules`);
    createLink.focus();
    expect(createLink).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Следваща сцена" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Продължи към игра" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Продължи" })).not.toBeInTheDocument();
  });

  it("keeps the requested game destination when the tutorial is skipped", () => {
    navigate({ redirect: "/mafia/create" });

    render(<TutorialFlipbook />);

    expect(screen.getByRole("link", { name: "Към Мафия" })).toHaveAttribute("href", "/mafia/create");
  });

  it("opens the final scene without removing the game choice when skipped", async () => {
    const user = userEvent.setup();
    render(<TutorialFlipbook />);

    await user.click(screen.getByRole("button", { name: "Избери игра" }));

    expect(await screen.findByRole("link", { name: "Създай стая" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Игра" })).toHaveValue("werewolves_classic");
    await user.selectOptions(screen.getByRole("combobox", { name: "Игра" }), "mafia_free");
    expect(await screen.findByRole("link", { name: "Създай стая" })).toHaveAttribute("href", "/mafia/create");
    expect(window.localStorage.getItem("tutorial-completed")).toBe("1");
  });

  it("preserves a safe explicit invitation destination at the final scene", async () => {
    const destination = "/mafia/join/ABC123?from=friend#invite";
    navigate({ step: "6", redirect: destination });
    render(<TutorialFlipbook />);

    expect(await screen.findByRole("link", { name: "Продължи към поканата" })).toHaveAttribute("href", destination);
    expect(screen.getByRole("link", { name: "Към поканата" })).toHaveAttribute("href", destination);
    expect(screen.getByRole("heading", { name: "Поканата те чака." })).toBeInTheDocument();
  });

  it("names the saved create destination after changing the rehearsal game", async () => {
    navigate({ step: "6", game: "werewolves_classic", redirect: "/werewolf/create?from=rules#start" });
    render(<TutorialFlipbook />);
    await userEvent.setup().selectOptions(screen.getByRole("combobox", { name: "Игра" }), "mafia_sport");
    expect(await screen.findByRole("link", { name: "Към стая за Върколак" })).toHaveAttribute("href", "/werewolf/create?from=rules#start");
    expect(screen.getByRole("link", { name: "Към Върколак" })).toHaveAttribute("href", "/werewolf/create?from=rules#start");
    expect(screen.getByRole("link", { name: "Или създай стая за Спортна Мафия" })).toHaveAttribute("href", "/mafia/create?mode=mafia_sport");
    expect(screen.getByText("Запазена дестинация: Върколак")).toBeVisible();
  });

  it("keeps an invitation ahead of the selected tutorial family after changing games", async () => {
    const destination = "/mafia/join/ABC123?from=friend#invite";
    navigate({ step: "6", redirect: destination });
    render(<TutorialFlipbook />);
    await userEvent.setup().selectOptions(screen.getByRole("combobox", { name: "Игра" }), "werewolves_classic");
    expect(await screen.findByRole("link", { name: "Продължи към поканата" })).toHaveAttribute("href", destination);
    expect(screen.getByRole("link", { name: "Към поканата" })).toHaveAttribute("href", destination);
  });

  it.each(["2", "4"])("places the scene %s explanation before the exercise and its feedback", async (step) => {
    navigate({ step });
    const { container } = render(<TutorialFlipbook />);
    await screen.findByRole("radio", { name: "Борис" });
    const callout = container.querySelector(".tutorial-slide-callout")!;
    const practice = container.querySelector(".tutorial-practice")!;
    expect(callout.compareDocumentPosition(practice) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(practice.lastElementChild).toHaveClass("tutorial-feedback");
    expect(callout).not.toHaveAttribute("open");
    await userEvent.setup().click(callout.querySelector("summary")!);
    expect(callout).toHaveAttribute("open");
  });

  it.each(["https://example.com", "//example.com", "/%2fexample.com", "/../private", "/mafia/../private", "/mafia/%2e%2e/private", "/mafia/%0aheader", "/\\example.com"])(
    "rejects unsafe destination %s and offers the family choice",
    (redirect) => {
      navigate({ redirect });
      render(<TutorialFlipbook />);

      expect(screen.getByRole("button", { name: "Избери игра" })).toBeInTheDocument();
      expect(document.querySelector("a.tutorial-skip-link")).not.toBeInTheDocument();
      expect(screen.getByRole("combobox", { name: "Игра" })).toHaveValue("werewolves_classic");
    },
  );

  it.each(["2.5", "0", "7", "NaN", "Infinity"])("normalizes invalid URL step %s", async (step) => {
    const user = userEvent.setup();
    navigate({ step });
    window.localStorage.setItem("tutorial-last-slide", "5");
    render(<TutorialFlipbook />);

    expect(screen.getByRole("heading", { name: "Масата се събира." })).toBeInTheDocument();
    expect(window.localStorage.getItem("tutorial-last-slide")).toBe("1");
    await user.click(screen.getByRole("button", { name: "Следваща сцена" }));
    expect(await screen.findByRole("heading", { name: "Очите се затварят." })).toBeInTheDocument();
  });

  it.each(["2.5", "0", "7", "NaN"])("ignores invalid stored step %s", (step) => {
    window.localStorage.setItem("tutorial-last-slide", step);
    render(<TutorialFlipbook />);

    expect(screen.getByRole("heading", { name: "Масата се събира." })).toBeInTheDocument();
    expect(window.localStorage.getItem("tutorial-last-slide")).toBe("1");
  });

  it("restores a valid stored scene without a URL step", async () => {
    window.localStorage.setItem("tutorial-last-slide", "4");
    render(<TutorialFlipbook />);
    expect(await screen.findByRole("heading", { name: "Гласът оставя следа." })).toBeInTheDocument();
  });

  it.each(["mafia_free", "mafia_sport"])("does not inherit %s progress on the first bare Werewolf visit", async (game) => {
    navigate({ game, step: "5" });
    const mafia = render(<TutorialFlipbook />);
    expect(await screen.findByRole("heading", { name: "Още една нощ. Или победа." })).toBeInTheDocument();
    mafia.unmount();
    navigate({});
    render(<TutorialFlipbook />);

    expect(screen.getByRole("heading", { name: "Масата се събира." })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Игра" })).toHaveValue("werewolves_classic");
    expect(window.localStorage.getItem(`tutorial-last-slide:${game}`)).toBe("5");
    expect(window.localStorage.getItem("tutorial-last-slide:werewolves_classic")).toBe("1");
    expect(new URLSearchParams(window.location.search).get("step")).toBe("1");
  });

  it("ignores the ambiguous legacy key when existing Mafia progress identifies the newer format", () => {
    window.localStorage.setItem("tutorial-last-slide", "6");
    window.localStorage.setItem("tutorial-last-slide:mafia_free", "6");
    render(<TutorialFlipbook />);
    expect(screen.getByRole("heading", { name: "Масата се събира." })).toBeInTheDocument();
  });

  it("keeps a returning Werewolf player's own progress after a Mafia visit", async () => {
    window.localStorage.setItem("tutorial-last-slide:werewolves_classic", "3");
    window.localStorage.setItem("tutorial-last-slide", "5");
    window.localStorage.setItem("tutorial-last-slide:mafia_free", "5");
    render(<TutorialFlipbook />);
    expect(await screen.findByRole("heading", { name: "Кой разказва истината?" })).toBeInTheDocument();
  });

  it("restores the selected mode's last scene ahead of legacy progress", async () => {
    window.localStorage.setItem("tutorial-last-slide", "4");
    window.localStorage.setItem("tutorial-last-slide:mafia_sport", "3");
    navigate({ game: "mafia_sport" });
    render(<TutorialFlipbook />);
    expect(await screen.findByRole("heading", { name: "Кой разказва истината?" })).toBeInTheDocument();
  });

  it("gives an explicit step priority over the selected mode's saved scene", async () => {
    window.localStorage.setItem("tutorial-last-slide:mafia_sport", "3");
    navigate({ game: "mafia_sport", step: "5" });
    render(<TutorialFlipbook />);
    expect(await screen.findByRole("heading", { name: "Още една нощ. Или победа." })).toBeInTheDocument();
    expect(window.localStorage.getItem("tutorial-last-slide:mafia_sport")).toBe("5");
  });

  it.each([
    [2, "Очите се затварят."],
    [3, "Кой разказва истината?"],
    [4, "Гласът оставя следа."],
    [5, "Още една нощ. Или победа."],
    [6, "Изборът сега е твой."],
  ])("renders direct step %i without falling back to the setup scene", async (step, heading) => {
    navigate({ step: String(step) });

    render(<TutorialFlipbook />);

    expect(await screen.findByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: new RegExp(`^${step}\\.`) })).toHaveAttribute(
      "aria-current",
      "step",
    );
  });

  it("follows a new deep link without remounting or overwriting its destination", async () => {
    navigate({ step: "6", redirect: "/werewolf/create" });
    render(<TutorialFlipbook />);
    expect(await screen.findByRole("heading", { name: "Изборът сега е твой." })).toBeVisible();

    act(() => navigate({ step: "5", redirect: "/mafia/create" }, "#lesson"));
    expect(await screen.findByRole("heading", { name: "Още една нощ. Или победа." })).toBeVisible();
    expect(window.localStorage.getItem("tutorial-last-slide")).toBe("5");

    await userEvent.setup().click(screen.getByRole("button", { name: "Следваща сцена" }));
    expect(await screen.findByRole("link", { name: "Към стая за Мафия" })).toHaveAttribute("href", "/mafia/create");
    expect(screen.queryByText(/Поканата ти е запазена/)).not.toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get("step")).toBe("6");
    expect(window.location.hash).toBe("#lesson");
  });

  it.each([
    ["/mafia/join/ABC123", "mafia_free"],
    ["/mafia/create?mode=mafia_sport", "mafia_sport"],
    ["/mafia-other/join", "werewolves_classic"],
  ])("infers the game only from a safe family destination %s", (redirect, mode) => {
    navigate({ redirect });
    render(<TutorialFlipbook />);
    expect(screen.getByRole("combobox", { name: "Игра" })).toHaveValue(mode);
  });

  it.each(TUTORIAL_MODES)("honors explicit %s without changing the invitation URL", async (game) => {
    const destination = "/mafia/join/ABC123?from=friend&seat=2#invite";
    navigate({ game, redirect: destination, step: "6" });
    render(<TutorialFlipbook />);
    expect(screen.getByRole("combobox", { name: "Игра" })).toHaveValue(game);
    expect(await screen.findByRole("link", { name: "Продължи към поканата" })).toHaveAttribute("href", destination);
  });

  it.each(TUTORIAL_MODES)("carries committed %s actions through scenes and a remount", async (game) => {
    navigate({ game, step: "2" });
    const user = userEvent.setup();
    const first = render(<TutorialFlipbook />);
    await user.click(await screen.findByRole("radio", { name: "Борис" }));
    expect(window.localStorage.getItem(`tutorial-practice-v1:${game}`)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Потвърди проверката" }));
    await user.click(screen.getByRole("button", { name: "Следваща сцена" }));
    await user.click(await screen.findByRole("button", { name: "Чуй Анна" }));
    await user.click(screen.getByRole("button", { name: "Чуй Галя" }));
    await user.click(screen.getByRole("button", { name: "Следваща сцена" }));
    await user.click(await screen.findByRole("radio", { name: "Борис" }));
    await user.click(screen.getByRole("button", { name: "Потвърди гласа" }));
    await user.click(screen.getByRole("radio", { name: "Анна" }));
    await user.click(screen.getByRole("button", { name: "Следваща сцена" }));
    expect(await screen.findByRole("heading", { name: "Борис напуска масата." })).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(`tutorial-practice-v1:${game}`)!)).toEqual({ night: "boris", vote: "boris", visited: ["anna", "galya"] });
    first.unmount();
    render(<TutorialFlipbook />);
    expect(await screen.findByRole("heading", { name: "Борис напуска масата." })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "3. Ден" }));
    expect(await screen.findByText("Прочетени: 2 / 3")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "2. Нощ" }));
    expect(await screen.findByRole("radio", { name: "Борис" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Потвърди проверката" })).toBeDisabled();
  });

  it("keeps an unconfirmed vote out of the result and can return to the exercise", async () => {
    navigate({ step: "4" });
    render(<TutorialFlipbook />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("radio", { name: "Галя" }));
    await user.click(screen.getByRole("button", { name: "Следваща сцена" }));
    expect(await screen.findByRole("heading", { name: "Още няма потвърден глас." })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Към гласуването" }));
    expect(await screen.findByRole("radio", { name: "Галя" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Потвърди гласа" })).toBeDisabled();
  });

  it("isolates all three modes and restores the previous mode's committed choice", async () => {
    navigate({ game: "werewolves_classic", step: "4" });
    render(<TutorialFlipbook />);
    const user = userEvent.setup();
    for (const [game, name] of [["werewolves_classic", "Анна"], ["mafia_free", "Борис"], ["mafia_sport", "Галя"]]) {
      await user.selectOptions(screen.getByRole("combobox", { name: "Игра" }), game!);
      expect(await screen.findByRole("button", { name: "Потвърди гласа" })).toBeDisabled();
      for (const radio of screen.getAllByRole("radio")) expect(radio).not.toBeChecked();
      await user.click(screen.getByRole("radio", { name: name! }));
      await user.click(screen.getByRole("button", { name: "Потвърди гласа" }));
    }
    await user.selectOptions(screen.getByRole("combobox", { name: "Игра" }), "werewolves_classic");
    expect(await screen.findByRole("radio", { name: "Анна" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Потвърди гласа" })).toBeDisabled();
  });

  it.each(["unavailable", "quota"])("keeps exercises usable when storage is %s", async (failure) => {
    navigate({ step: "4" });
    if (failure === "unavailable") vi.spyOn(window.localStorage, "getItem").mockImplementation(() => { throw new DOMException("Denied", "SecurityError"); });
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    render(<TutorialFlipbook />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("radio", { name: "Борис" }));
    await user.click(screen.getByRole("button", { name: "Потвърди гласа" }));
    await user.click(screen.getByRole("button", { name: "Следваща сцена" }));
    expect(await screen.findByRole("heading", { name: "Борис напуска масата." })).toBeInTheDocument();
  });

  it.each(["not-json", '{"night":"unknown","vote":"unknown","visited":["unknown"]}'])("ignores malformed saved practice %s", async (stored) => {
    navigate({ game: "mafia_free", step: "5" });
    window.localStorage.setItem("tutorial-practice-v1:mafia_free", stored);
    render(<TutorialFlipbook />);
    expect(await screen.findByRole("heading", { name: "Още няма потвърден глас." })).toBeInTheDocument();
  });

  it("does not hijack arrow keys in the game selector or radio group", async () => {
    navigate({ step: "4" });
    render(<TutorialFlipbook />);
    const radio = await screen.findByRole("radio", { name: "Анна" });
    fireEvent.keyDown(radio, { key: "ArrowRight" });
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Игра" }), { key: "ArrowRight" });
    expect(screen.getByRole("heading", { name: "Гласът оставя следа." })).toBeInTheDocument();
    const stage = screen.getByRole("region", { name: "Сцена 4: Глас" });
    fireEvent.keyDown(stage, { key: "ArrowRight" });
    expect(await screen.findByRole("heading", { name: "Още една нощ. Или победа." })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Сцена 5: Развръзка" })).getByRole("heading", { level: 2 })).toHaveTextContent("Още няма потвърден глас.");
  });
});
