import { useReducer } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { type GameFamily, type RoleCode } from "@werewolf/shared";
import { initialState, lobbyFormReducer, currentConfig, type LobbyFormState } from "@/lib/lobby-form";
import { AdvancedDrawer } from "../AdvancedDrawer";

function DrawerHarness({ initial }: { initial: LobbyFormState }) {
  const [state, dispatch] = useReducer(lobbyFormReducer, initial);
  const config = currentConfig(state);
  return (
    <>
      <AdvancedDrawer state={state} dispatch={dispatch} />
      <output data-testid="configuration">{JSON.stringify(config)}</output>
    </>
  );
}

function configured() {
  return JSON.parse(screen.getByTestId("configuration").textContent ?? "{}");
}

describe("advanced capacity input", () => {
  it.each(["werewolves", "mafia"] as const)("describes and enforces the %s capacity range", async (family) => {
    const user = userEvent.setup();
    render(<DrawerHarness initial={initialState({ family })} />);
    await user.click(screen.getByText("Покажи още настройки"));
    const input = screen.getByRole("spinbutton", { name: "Максимум играчи" });

    expect(input).toHaveAttribute("min", family === "werewolves" ? "12" : "10");
    expect(input).toHaveAttribute("max", "30");
    expect(input).toHaveAttribute("step", "1");
    expect(input).toHaveAccessibleDescription(/30/);
    fireEvent.change(input, { target: { value: "31" } });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(/цяло число/);
    expect(configured().maxPlayers).toBe(family === "werewolves" ? 12 : 10);

    fireEvent.blur(input);
    expect(input).toHaveValue(30);
    expect(configured().maxPlayers).toBe(30);
    expect(input).not.toHaveAttribute("aria-invalid", "true");
  });

  it("keeps an empty draft editable and commits only a valid configuration", async () => {
    const user = userEvent.setup();
    render(<DrawerHarness initial={initialState({ family: "werewolves" })} />);
    await user.click(screen.getByText("Покажи още настройки"));
    const input = screen.getByRole("spinbutton", { name: "Максимум играчи" });

    await user.clear(input);
    expect(input).toHaveValue(null);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(configured().maxPlayers).toBe(12);
    await user.type(input, "18");
    expect(input).toHaveValue(18);
    expect(configured().maxPlayers).toBe(18);
    expect(input).not.toHaveAttribute("aria-invalid", "true");

    await user.clear(input);
    fireEvent.blur(input);
    expect(input).toHaveValue(18);
    expect(configured().maxPlayers).toBe(18);
  });

  it.each([
    ["13.5", 14],
    ["1", 12],
    ["-1", 12],
  ] as const)("normalizes invalid draft %s on blur without breaking rendering", async (draft, expected) => {
    const user = userEvent.setup();
    render(<DrawerHarness initial={initialState({ family: "werewolves" })} />);
    await user.click(screen.getByText("Покажи още настройки"));
    const input = screen.getByRole("spinbutton", { name: "Максимум играчи" });

    fireEvent.change(input, { target: { value: draft } });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(configured().maxPlayers).toBe(12);
    fireEvent.blur(input);
    expect(input).toHaveValue(expected);
    expect(configured().maxPlayers).toBe(expected);
  });
});

describe("manual optional role controls", () => {
  it.each([
    { family: "werewolves", requested: true },
    { family: "werewolves", requested: false },
    { family: "mafia", requested: true },
    { family: "mafia", requested: false },
  ] as const)("restores the hydrated $family reveal=$requested checkbox after removing Jester", async ({ family, requested }) => {
    const user = userEvent.setup();
    render(<DrawerHarness initial={initialState({
      family,
      urlParams: new URLSearchParams({ players: "10", jester: "1", reveal: String(Number(requested)) }),
    })} />);
    await user.click(screen.getByText("Покажи още настройки"));
    const reveal = screen.getByRole("checkbox", { name: "Разкриване на ролята при смърт" });
    expect(reveal).toBeDisabled();
    expect(reveal).not.toBeChecked();
    expect(reveal).toHaveAccessibleDescription(/всички роли остават скрити до края/);
    expect(configured().roles.jester).toBe(1);

    await user.click(screen.getByRole("checkbox", { name: "Добави Шут с лична победа" }));
    expect(reveal).toBeEnabled();
    expect(reveal).not.toHaveAttribute("aria-describedby");
    if (requested) expect(reveal).toBeChecked();
    else expect(reveal).not.toBeChecked();
    expect(configured().roles.jester ?? 0).toBe(0);
    expect(configured().revealRolesOnDeath).toBe(requested);
  });

  it.each(["werewolves", "mafia"] as const)("explains hidden roles with Jester and restores the %s host preference when removed", async (family) => {
    const user = userEvent.setup();
    render(<DrawerHarness initial={initialState({ family })} />);
    await user.click(screen.getByText("Покажи още настройки"));
    const reveal = screen.getByRole("checkbox", { name: "Разкриване на ролята при смърт" });
    const jester = screen.getByRole("checkbox", { name: "Добави Шут с лична победа" });
    expect(reveal).toBeEnabled();
    expect(reveal).toBeChecked();
    await user.click(jester);
    expect(reveal).toBeDisabled();
    expect(reveal).not.toBeChecked();
    expect(reveal).toHaveAccessibleDescription(/всички роли остават скрити до края/);
    expect(configured().revealRolesOnDeath).toBe(false);
    await user.click(jester);
    expect(reveal).toBeEnabled();
    expect(reveal).toBeChecked();
    expect(configured().revealRolesOnDeath).toBe(true);
  });

  it.each(["werewolves", "mafia"] as const)("uses the actual manual %s roster to constrain death reveals", async (family) => {
    const user = userEvent.setup();
    const { rerender } = render(<AdvancedDrawer state={manualState(family, "jester", true)} dispatch={() => {}} />);
    await user.click(screen.getByText("Покажи още настройки"));
    const reveal = screen.getByRole("checkbox", { name: "Разкриване на ролята при смърт" });
    expect(reveal).toBeDisabled();
    expect(reveal).not.toBeChecked();
    rerender(<AdvancedDrawer state={manualState(family, "jester", false)} dispatch={() => {}} />);
    expect(reveal).toBeEnabled();
    expect(reveal).toBeChecked();
  });

  it.each([
    ["werewolves", "jester", "Добави Шут с лична победа"],
    ["mafia", "jester", "Добави Шут с лична победа"],
    ["mafia", "maniac", "Добави Маниак като трета страна"],
  ] as const)("shows actual %s %s inclusion and explains why its toggle is disabled", async (family, role, label) => {
    const user = userEvent.setup();
    const initial = manualState(family, role, true);
    const { rerender } = render(<AdvancedDrawer state={initial} dispatch={() => {}} />);
    await user.click(screen.getByText("Покажи още настройки"));
    const toggle = screen.getByRole("checkbox", { name: label });

    expect(toggle).toBeDisabled();
    expect(toggle).toBeChecked();
    expect(toggle).toHaveAccessibleDescription(/Роли/);

    rerender(<AdvancedDrawer state={manualState(family, role, false)} dispatch={() => {}} />);
    expect(toggle).toBeDisabled();
    expect(toggle).not.toBeChecked();
  });

  it.each(["werewolves", "mafia"] as const)("still adds Jester to a %s preset roster", async (family) => {
    const user = userEvent.setup();
    render(<DrawerHarness initial={initialState({ family })} />);
    await user.click(screen.getByText("Покажи още настройки"));
    const toggle = screen.getByRole("checkbox", { name: "Добави Шут с лична победа" });

    expect(toggle).toBeEnabled();
    await user.click(toggle);
    expect(configured().roles.jester).toBe(1);
  });
});

function manualState(family: GameFamily, role: RoleCode, included: boolean) {
  const state = lobbyFormReducer(initialState({ family }), { type: "SET_MANUAL_ROLES_ENABLED", enabled: true });
  const reserve = family === "werewolves" ? "ordinary_villager" : "civilian";
  return {
    ...state,
    manualRoles: included ? {
      ...state.manualRoles,
      [reserve]: (state.manualRoles[reserve] ?? 0) - 1,
      [role]: 1,
    } : state.manualRoles,
    advanced: { ...state.advanced, [role === "jester" ? "jesterEnabled" : "maniacEnabled"]: !included },
  };
}
