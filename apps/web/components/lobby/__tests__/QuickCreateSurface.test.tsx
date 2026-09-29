import { useReducer } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ROLE_DEFINITIONS, type GameFamily, type RoleCode } from "@werewolf/shared";
import { currentConfig, initialState, lobbyFormReducer, type LobbyFormState } from "@/lib/lobby-form";
import { playCue } from "@/lib/sound";
import { LobbyWizard } from "../LobbyWizard";
import { QuickCreateSurface } from "../QuickCreateSurface";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/sound", () => ({ playCue: vi.fn() }));

const families = ["werewolves", "mafia"] as const;
const primaryLabel = (family: GameFamily) => family === "werewolves" ? "Създай селото" : "Отвори масата";

function setup(initial: LobbyFormState) {
  const onSubmit = vi.fn();
  const onOpenDetails = vi.fn();
  function Harness() {
    const [state, dispatch] = useReducer(lobbyFormReducer, initial);
    return (
      <>
        <QuickCreateSurface state={state} dispatch={dispatch} onSubmit={onSubmit}
          onOpenDetails={onOpenDetails} transition={(update) => update()} />
        <output data-testid="configuration">{JSON.stringify(currentConfig(state))}</output>
      </>
    );
  }
  return { ...render(<Harness />), user: userEvent.setup(), onSubmit, onOpenDetails };
}

function roleNameWithCount(role: RoleCode, count: number) {
  const name = ROLE_DEFINITIONS[role].nameBg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${name}\\s*[,·:]?\\s*[×x]?\\s*${count}(?:\\D|$)`);
}

describe("QuickCreateSurface redesign", () => {
  it.each(families)("names every occupied %s roster button with its role and count", (family) => {
    const state = initialState({ family });
    setup(state);
    const roster = screen.getByLabelText("Всички роли в състава");
    const roles = Object.entries(currentConfig(state).roles).filter(([, count]) => count);

    expect(within(roster).getAllByRole("button")).toHaveLength(roles.length);
    for (const [role, count] of roles) {
      expect(within(roster).getByRole("button", { name: roleNameWithCount(role as RoleCode, count!) }))
        .toHaveAttribute("type", "button");
    }
  });

  it.each(families)("reports a ready roster and preserves both %s submit labels", async (family) => {
    const { user, onSubmit } = setup(initialState({ family }));
    expect(screen.getByText("Съставът е готов", { exact: true })).toBeInTheDocument();
    expect(screen.queryByText("Готови за игра", { exact: true })).not.toBeInTheDocument();
    const actions = screen.getAllByRole("button", { name: primaryLabel(family) });
    expect(actions).toHaveLength(2);
    for (const action of actions) {
      expect(action).toBeEnabled();
      await user.click(action);
    }
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it.each(families)("opens a local %s role preview and restores focus without losing edited configuration", async (family) => {
    const { user, onSubmit, onOpenDetails } = setup(initialState({ family }));
    await user.click(screen.getByRole("button", { name: "Увеличи броя играчи" }));
    await user.click(screen.getByRole("button", { name: "На живо" }));
    const before = screen.getByTestId("configuration").textContent;
    const url = window.location.href;
    const roster = screen.getByLabelText("Всички роли в състава");
    const config = JSON.parse(before!) as ReturnType<typeof currentConfig>;

    // Different openers catch stale return-focus state on the second preview.
    for (const role of (family === "werewolves" ? ["werewolf", "seer"] : ["mafioso", "commissioner"]) as RoleCode[]) {
      const trigger = within(roster).getByRole("button", { name: roleNameWithCount(role, config.roles[role]!) });
      await user.click(trigger);
      const dialog = screen.getByRole("dialog", { name: ROLE_DEFINITIONS[role].nameBg });
      expect(within(dialog).getByText(ROLE_DEFINITIONS[role].fullDescriptionBg)).toBeVisible();
      expect(dialog.contains(document.activeElement)).toBe(true);
      expect(trigger).toHaveAttribute("aria-expanded", "true");
      await user.keyboard("{Escape}");
      await waitFor(() => expect(dialog).not.toBeInTheDocument());
      expect(trigger).toHaveFocus();
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(screen.getByTestId("configuration").textContent).toBe(before);
      expect(window.location.href).toBe(url);
    }
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onOpenDetails).not.toHaveBeenCalled();
  });

  it.each(families)("does not mark an invalid %s roster ready or enable either submit action", async (family) => {
    const initial = initialState({ family });
    const state = lobbyFormReducer(initial, {
      type: "SET_MANUAL_ROLES",
      roles: { [family === "werewolves" ? "ordinary_villager" : "civilian"]: initial.playerCount },
    });
    const { user, onSubmit } = setup(state);
    expect(screen.getByText("Провери състава", { exact: true })).toBeInTheDocument();
    expect(screen.queryByText("Съставът е готов", { exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).not.toBeEmptyDOMElement();
    for (const action of screen.getAllByRole("button", { name: primaryLabel(family) })) {
      expect(action).toBeDisabled();
      await user.click(action);
    }
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("keeps sport mafia at exactly ten after context changes and a local preview", async () => {
    const { user } = setup(initialState({ family: "mafia" }));
    await user.click(screen.getByRole("button", { name: /Спортна маса/ }));
    await user.click(screen.getByRole("button", { name: "На живо" }));
    expect(screen.getByText("Точно 10 играчи", { exact: true })).toBeInTheDocument();
    expect(screen.queryByRole("slider", { name: "Брой играчи" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Увеличи броя играчи" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Намали броя играчи" })).not.toBeInTheDocument();
    const trigger = screen.getByRole("button", { name: roleNameWithCount("don", 1) });
    await user.click(trigger);
    await user.click(within(screen.getByRole("dialog", { name: ROLE_DEFINITIONS.don.nameBg }))
      .getAllByRole("button", { name: "Затвори ролята" })[0]!);
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(JSON.parse(screen.getByTestId("configuration").textContent!)).toMatchObject({
      mode: "mafia_sport", playerCount: 10,
      roles: { civilian: 6, mafioso: 2, don: 1, commissioner: 1 },
    });
  });

  it.each(families)("submits %s once without celebrating before a room exists", async (family) => {
    push.mockClear();
    vi.mocked(playCue).mockClear();
    const user = userEvent.setup();
    const { container } = render(<LobbyWizard family={family} />);
    await user.dblClick(screen.getAllByRole("button", { name: primaryLabel(family) })[0]!);
    expect(container.querySelector(".lobby-confetti")).not.toBeInTheDocument();
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    const url = new URL(push.mock.calls[0]![0] as string, "http://localhost");
    expect(url.pathname).toMatch(/^\/play\/[A-Z0-9]{6}$/);
    expect(url.searchParams.get("mode")).toBe(family === "werewolves" ? "werewolves_classic" : "mafia_free");
    expect(url.searchParams.get("players")).toBe(family === "werewolves" ? "12" : "10");
    expect(playCue).not.toHaveBeenCalled();
    expect(container.querySelector(".lobby-confetti")).not.toBeInTheDocument();
  });
});
