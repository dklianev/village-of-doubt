import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ROLE_DEFINITIONS } from "@werewolf/shared";
import { describe, expect, it, vi } from "vitest";
import { LobbyWizard } from "../LobbyWizard";

// Fail at module evaluation, not rendering, if a quick preview imports the editor again.
vi.mock("../StepRoles", () => { throw new Error("StepRoles was eagerly imported"); });
vi.mock("../AdvancedDrawer", () => { throw new Error("AdvancedDrawer was eagerly imported"); });
vi.mock("../StepStyle", () => { throw new Error("Narrator settings were eagerly imported"); });
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("Quick Create import boundary", () => {
  it.each(["werewolves", "mafia"] as const)("renders and previews %s roles without evaluating deferred settings", async (family) => {
    const user = userEvent.setup();
    render(<LobbyWizard family={family} />);
    const role = family === "werewolves" ? "seer" : "commissioner";
    const roster = screen.getByLabelText("Всички роли в състава");
    const trigger = within(roster).getByRole("button", { name: new RegExp(ROLE_DEFINITIONS[role].nameBg) });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: ROLE_DEFINITIONS[role].nameBg });
    expect(within(dialog).getByText(ROLE_DEFINITIONS[role].fullDescriptionBg)).toBeVisible();
    for (const tag of ROLE_DEFINITIONS[role].tags) expect(within(dialog).getByText(tag)).toBeVisible();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    expect(screen.getAllByRole("button", { name: family === "werewolves" ? "Създай селото" : "Отвори масата" })[0]).toBeEnabled();
  });
});
