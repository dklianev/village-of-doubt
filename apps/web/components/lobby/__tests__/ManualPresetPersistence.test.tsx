import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useReducer } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type GameFamily, type RoleCode, type RoleDistribution } from "@werewolf/shared";
import { initialState, lobbyFormReducer } from "@/lib/lobby-form";
import { LobbyWizard } from "../LobbyWizard";
import { StepRoles } from "../StepRoles";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/sound", () => ({ playCue: vi.fn() }));

const savedKey = "werewolf-mafia-manual-role-preset-v1:werewolves";
const savedRoles: RoleDistribution = { ordinary_villager: 6, werewolf: 3, seer: 1, cupid: 1, healer: 1 };
const originalScrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTo");

function ManualRoles({ family = "werewolves", playerCount }: { family?: GameFamily; playerCount?: number }) {
  const [state, dispatch] = useReducer(
    lobbyFormReducer,
    lobbyFormReducer(initialState({
      family,
      ...(playerCount === undefined ? {} : { urlParams: new URLSearchParams({ players: String(playerCount) }) }),
    }), { type: "SET_MANUAL_ROLES_ENABLED", enabled: true }),
  );
  return <StepRoles state={state} dispatch={dispatch} embedded />;
}

describe("manual preset persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
    // jsdom does not implement element scrolling used by the settings sheet.
    Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
  });

  afterEach(() => {
    window.localStorage.clear();
    if (originalScrollTo) {
      Object.defineProperty(HTMLElement.prototype, "scrollTo", originalScrollTo);
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, "scrollTo");
    }
  });

  it("loads the explicitly saved healer after selecting classic and returning to manual, including after remount", async () => {
    const user = userEvent.setup();
    const first = render(<LobbyWizard family="werewolves" />);
    await user.click(screen.getByRole("button", { name: "Настрой детайлите" }));
    const dialog = within(screen.getByRole("dialog", { name: "Настрой детайлите" }));
    await user.click(dialog.getByRole("button", { name: "Настрой ръчно" }));
    await user.click(dialog.getByRole("button", { name: "Добави Лечител" }));
    await user.click(dialog.getByRole("button", { name: "Запази шаблон" }));
    const saved = window.localStorage.getItem(savedKey);
    expect(JSON.parse(saved!)).toMatchObject({ roles: { healer: 1 } });

    await user.click(dialog.getByRole("button", { name: "Класическа игра" }));
    await user.click(dialog.getByRole("button", { name: "Ръчно" }));
    expect(dialog.getByRole("button", { name: "Премахни Лечител" })).toBeDisabled();
    await user.click(dialog.getByRole("button", { name: "Зареди шаблон" }));
    expect(dialog.getByRole("button", { name: "Премахни Лечител" })).toBeEnabled();
    expect(window.localStorage.getItem(savedKey)).toBe(saved);

    await user.click(dialog.getByRole("button", { name: "Премахни Лечител" }));
    expect(window.localStorage.getItem(savedKey)).toBe(saved);
    first.unmount();
    render(<LobbyWizard family="werewolves" />);
    await user.click(screen.getByRole("button", { name: "Настрой детайлите" }));
    await user.click(screen.getByRole("button", { name: "Настрой ръчно" }));
    await user.click(screen.getByRole("button", { name: "Зареди шаблон" }));
    expect(screen.getByRole("button", { name: "Премахни Лечител" })).toBeEnabled();
  });

  it("does not create a saved template from unsaved manual edits", async () => {
    const user = userEvent.setup();
    render(<LobbyWizard family="werewolves" />);
    await user.click(screen.getByRole("button", { name: "Настрой детайлите" }));
    await user.click(screen.getByRole("button", { name: "Настрой ръчно" }));
    await user.click(screen.getByRole("button", { name: "Добави Лечител" }));
    await user.click(screen.getByRole("button", { name: "Зареди шаблон" }));
    expect(screen.getByText("Няма запазен шаблон за тази игра.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Премахни Лечител" })).toBeEnabled();
    expect(window.localStorage.getItem(savedKey)).toBeNull();
  });

  it("loads the existing saved-key format without requiring new metadata", async () => {
    window.localStorage.setItem(savedKey, JSON.stringify({ roles: savedRoles }));
    const user = userEvent.setup();
    render(<ManualRoles />);
    await user.click(screen.getByRole("button", { name: "Зареди шаблон" }));
    expect(screen.getByText("Шаблонът е зареден.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Премахни Лечител" })).toBeEnabled();
    expect(screen.getByText("12/12 роли", { exact: false })).toBeInTheDocument();
  });

  it("keeps saved templates separate between game families", async () => {
    const saved = JSON.stringify({ roles: savedRoles });
    window.localStorage.setItem(savedKey, saved);
    const user = userEvent.setup();
    render(<ManualRoles family="mafia" />);
    await user.click(screen.getByRole("button", { name: "Зареди шаблон" }));
    expect(screen.getByText("Няма запазен шаблон за тази игра.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Запази шаблон" }));
    expect(window.localStorage.getItem(savedKey)).toBe(saved);
    expect(window.localStorage.getItem("werewolf-mafia-manual-role-preset-v1:mafia")).not.toBeNull();
    await user.click(screen.getByRole("button", { name: "Зареди шаблон" }));
    expect(screen.getByText("Шаблонът е зареден.")).toBeInTheDocument();
  });

  it.each<{
    family: GameFamily;
    playerCount: number;
    reserve: RoleCode;
    expectedReserve: number;
    roles: RoleDistribution;
  }>([
    { family: "werewolves", playerCount: 13, reserve: "ordinary_villager", expectedReserve: 7, roles: savedRoles },
    { family: "werewolves", playerCount: 10, reserve: "ordinary_villager", expectedReserve: 4, roles: savedRoles },
    { family: "werewolves", playerCount: 6, reserve: "ordinary_villager", expectedReserve: 0, roles: savedRoles },
    { family: "werewolves", playerCount: 30, reserve: "ordinary_villager", expectedReserve: 24, roles: savedRoles },
    ...[
      { playerCount: 13, expectedReserve: 8 },
      { playerCount: 6, expectedReserve: 1 },
      { playerCount: 5, expectedReserve: 0 },
    ].map((size) => ({
      ...size,
      family: "mafia" as const,
      reserve: "civilian" as const,
      roles: { civilian: 5, mafioso: 2, don: 1, commissioner: 1, doctor: 1 },
    })),
  ] as const)("loads $family at $playerCount players by changing only reserve seats", async ({ family, playerCount, reserve, expectedReserve, roles }) => {
    const key = `werewolf-mafia-manual-role-preset-v1:${family}`;
    const saved = JSON.stringify({ playerCount: family === "mafia" ? 10 : 12, roles });
    window.localStorage.setItem(key, saved);
    const user = userEvent.setup();
    render(<ManualRoles family={family} playerCount={playerCount} />);
    await user.click(screen.getByRole("button", { name: "Зареди шаблон" }));
    expect(screen.getByText(`${playerCount}/${playerCount} роли`, { exact: false })).toBeInTheDocument();
    expect(window.localStorage.getItem(key)).toBe(saved);

    await user.click(screen.getByRole("button", { name: "Запази шаблон" }));
    const loaded = JSON.parse(window.localStorage.getItem(key)!);
    expect(loaded.playerCount).toBe(playerCount);
    expect(loaded.roles[reserve] ?? 0).toBe(expectedReserve);
    const { [reserve]: _originalReserve, ...specialRoles } = roles;
    const { [reserve]: _loadedReserve, ...loadedSpecialRoles } = loaded.roles;
    expect(loadedSpecialRoles).toEqual(specialRoles);
  });

  it.each([
    {
      family: "werewolves",
      roleName: "Лечител",
      roles: { ordinary_villager: 1, werewolf: 3, seer: 1, healer: 1, witch: 1, hunter: 1 },
    },
    {
      family: "mafia",
      roleName: "Доктор",
      roles: { civilian: 1, mafioso: 3, don: 1, commissioner: 1, doctor: 1, bodyguard: 1 },
    },
  ] as const)("rejects a $family shrink that would delete special roles without changing roster or history", async ({ family, roleName, roles }) => {
    const key = `werewolf-mafia-manual-role-preset-v1:${family}`;
    const saved = JSON.stringify({ roles });
    window.localStorage.setItem(key, saved);
    const user = userEvent.setup();
    render(<ManualRoles family={family} playerCount={6} />);
    const remove = screen.getByRole("button", { name: `Премахни ${roleName}` });
    await user.click(remove);
    await user.click(screen.getByRole("button", { name: `Добави ${roleName}` }));
    const undo = screen.getByRole("button", { name: "Отмени последната промяна" });
    const redo = screen.getByRole("button", { name: "Повтори последната промяна" });
    await user.click(undo);
    const roster = screen.getByRole("region", { name: "Състав на масата" });
    const before = roster.textContent;

    await user.click(screen.getByRole("button", { name: "Зареди шаблон" }));
    expect(screen.getByText(/не може да се зареди за 6 играчи без премахване на специални роли/)).toBeInTheDocument();
    expect(roster.textContent).toBe(before);
    expect(screen.getByText("6/6 роли", { exact: false })).toBeInTheDocument();
    expect(window.localStorage.getItem(key)).toBe(saved);
    expect(undo).toBeEnabled();
    expect(redo).toBeEnabled();
    expect(remove).toBeDisabled();
    await user.click(redo);
    expect(remove).toBeEnabled();
    await user.click(undo);
    expect(remove).toBeDisabled();
  });

  it("rejects growth beyond the reserve role limit without changing the current roster", async () => {
    const saved = JSON.stringify({ roles: { ordinary_villager: 2, werewolf: 2, seer: 1, healer: 1 } });
    window.localStorage.setItem(savedKey, saved);
    const user = userEvent.setup();
    render(<ManualRoles playerCount={30} />);
    const roster = screen.getByRole("region", { name: "Състав на масата" });
    const before = roster.textContent;
    await user.click(screen.getByRole("button", { name: "Зареди шаблон" }));
    expect(screen.getByText(/надвиши допустимият брой.*Селянин/)).toBeInTheDocument();
    expect(roster.textContent).toBe(before);
    expect(screen.getByText("30/30 роли", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Отмени последната промяна" })).toBeDisabled();
    expect(window.localStorage.getItem(savedKey)).toBe(saved);
  });

  it("rejects a mafia template whose total exceeds the family player limit", async () => {
    const key = "werewolf-mafia-manual-role-preset-v1:mafia";
    const saved = JSON.stringify({ roles: { civilian: 24, mafioso: 1 } });
    window.localStorage.setItem(key, saved);
    const user = userEvent.setup();
    render(<ManualRoles family="mafia" />);
    await user.click(screen.getByRole("button", { name: "Зареди шаблон" }));
    expect(screen.getByText("Запазеният шаблон не може да бъде прочетен.")).toBeInTheDocument();
    expect(screen.getByText("10/10 роли", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Отмени последната промяна" })).toBeDisabled();
    expect(window.localStorage.getItem(key)).toBe(saved);
  });

  it.each([
    ["invalid JSON", "{"],
    ["empty stored value", ""],
    ["null", "null"],
    ["missing roles", "{}"],
    ["null roles", '{"roles":null}'],
    ["array roles", '{"roles":[]}'],
    ["empty roles", '{"roles":{}}'],
    ["zero total", '{"roles":{"healer":0,"ordinary_villager":0}}'],
    ["total below the family minimum", '{"roles":{"ordinary_villager":3,"werewolf":2}}'],
    ["total above the family maximum", '{"roles":{"ordinary_villager":24,"werewolf":7}}'],
    ["string roles", '{"roles":"healer"}'],
    ["unknown role", '{"roles":{"unknown_role":1}}'],
    ["prototype key", '{"roles":{"__proto__":1}}'],
    ["wrong family", '{"roles":{"mafioso":1}}'],
    ["string count", '{"roles":{"healer":"1"}}'],
    ["null count", '{"roles":{"healer":null}}'],
    ["negative count", '{"roles":{"healer":-1}}'],
    ["fractional count", '{"roles":{"healer":0.5}}'],
    ["excessive count", '{"roles":{"healer":1000000}}'],
  ])("rejects %s without changing the roster or undo history", async (_name, raw) => {
    window.localStorage.setItem(savedKey, raw);
    const user = userEvent.setup();
    render(<ManualRoles />);
    await user.click(screen.getByRole("button", { name: "Зареди шаблон" }));
    expect(screen.getByText("Запазеният шаблон не може да бъде прочетен.")).toBeInTheDocument();
    expect(screen.getByText("12/12 роли", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Премахни Лечител" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Отмени последната промяна" })).toBeDisabled();
    expect(window.localStorage.getItem(savedKey)).toBe(raw);
  });

  it("reports a failed save and leaves the previous saved template intact", async () => {
    const saved = JSON.stringify({ roles: savedRoles });
    window.localStorage.setItem(savedKey, saved);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage full", "QuotaExceededError");
    });
    const user = userEvent.setup();
    render(<ManualRoles />);
    await user.click(screen.getByRole("button", { name: "Запази шаблон" }));
    expect(screen.getByText("Шаблонът не може да бъде запазен в този браузър.")).toBeInTheDocument();
    expect(window.localStorage.getItem(savedKey)).toBe(saved);
  });

  it("reports a failed load when storage access is denied", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage denied", "SecurityError");
    });
    const user = userEvent.setup();
    render(<ManualRoles />);
    await user.click(screen.getByRole("button", { name: "Зареди шаблон" }));
    expect(screen.getByText("Запазеният шаблон не може да бъде прочетен.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Отмени последната промяна" })).toBeDisabled();
  });
});
