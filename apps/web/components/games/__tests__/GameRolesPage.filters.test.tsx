import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ROLE_DEFINITIONS, type RoleCode } from "@werewolf/shared";
import { GameRolesPage } from "../game-roles-page";

function visibleRoles(container: HTMLElement) {
  return [...container.querySelectorAll(".role-codex-card")].map((card) =>
    [...card.classList].find((name) => name.startsWith("role-") && name in roleClasses)!,
  ).map((name) => roleClasses[name]!);
}

const roleClasses = Object.fromEntries(
  (Object.keys(ROLE_DEFINITIONS) as RoleCode[]).map((role) => [`role-${role}`, role]),
);

describe("roles catalogue discovery", () => {
  it.each(["werewolves", "mafia"] as const)("keeps %s search disabled until hydration can retain typed input", async (family) => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<GameRolesPage family={family} />);
    document.body.append(container);
    const serverInput = within(container).getByRole("textbox", { name: "Търси роля" });
    expect(serverInput).toBeDisabled();

    render(<GameRolesPage family={family} />, { container, hydrate: true });
    const input = within(container).getByRole("textbox", { name: "Търси роля" });
    expect(input).toBe(serverInput);
    expect(input).toBeEnabled();
    await userEvent.setup().type(input, "несъществуваща");
    expect(input).toHaveValue("несъществуваща");
    expect(within(container).getByRole("heading", { name: "Няма роля по този филтър" })).toBeVisible();
  });

  it.each([
    ["werewolves", ["ordinary_villager", "werewolf", "seer", "healer"]],
    ["mafia", ["civilian", "mafioso", "commissioner", "doctor"]],
  ] as const)("introduces the core %s roles before special roles", (family, firstRoles) => {
    const { container } = render(<GameRolesPage family={family} />);
    expect(visibleRoles(container).slice(0, 4)).toEqual(firstRoles);
  });

  it("keeps explicit night ordering and team grouping available", async () => {
    const user = userEvent.setup();
    const { container } = render(<GameRolesPage family="werewolves" />);
    await user.click(screen.getByRole("button", { name: "Филтри и подредба" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Подредба" }), "night");
    const nightOrders = visibleRoles(container).map((role) => ROLE_DEFINITIONS[role].nightOrder ?? Infinity);
    expect(nightOrders).toEqual([...nightOrders].sort((a, b) => a - b));

    await user.selectOptions(screen.getByRole("combobox", { name: "Подредба" }), "team");
    const teams = visibleRoles(container).map((role) => ROLE_DEFINITIONS[role].team);
    expect(teams[0]).toBe("village");
    expect(teams.lastIndexOf("village")).toBeLessThan(teams.indexOf("werewolves"));
  });

  it("retains active filters when collapsed and resets search, filters and ordering together", async () => {
    const user = userEvent.setup();
    const { container } = render(<GameRolesPage family="werewolves" />);
    const toggle = screen.getByRole("button", { name: "Филтри и подредба" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await user.click(within(screen.getByRole("group", { name: "Тип роли" })).getByRole("button", { name: "Нощни" }));
    await user.click(within(screen.getByRole("group", { name: "Отбори" })).getByRole("button", { name: "Върколаци" }));
    expect(screen.getByRole("button", { name: "Нощни" })).toHaveAttribute("aria-pressed", "true");
    await user.selectOptions(screen.getByRole("combobox", { name: "Подредба" }), "night");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAccessibleName("Филтри и подредба, 3 активни");
    expect(visibleRoles(container)).toEqual(["werewolf"]);

    await user.type(screen.getByRole("textbox", { name: "Търси роля" }), "несъществуваща");
    expect(screen.getByRole("heading", { name: "Няма роля по този филтър" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Изчисти филтрите" }));
    expect(screen.getByRole("textbox", { name: "Търси роля" })).toHaveValue("");
    expect(toggle).toHaveAccessibleName("Филтри и подредба");
    expect(visibleRoles(container).slice(0, 2)).toEqual(["ordinary_villager", "werewolf"]);
    await user.click(toggle);
    expect(screen.getByRole("combobox", { name: "Подредба" })).toHaveValue("core");
  });
});
