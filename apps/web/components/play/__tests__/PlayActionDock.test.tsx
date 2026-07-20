import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlayActionDock } from "@/components/play/PlayActionDock";

const dockCss = readFileSync(resolve(process.cwd(), "components/play/PlayActionDock.module.css"), "utf8");
const playRoomCss = readFileSync(resolve(process.cwd(), "components/play/PlayRoom.module.css"), "utf8");

function dock(props: { compact: boolean; expanded: boolean; onExpandedChange?: (expanded: boolean) => void }) {
  return (
    <PlayActionDock
      eyebrow="личен ход"
      heading="Избери цел"
      kind="action"
      compact={props.compact}
      expanded={props.expanded}
      onExpandedChange={props.onExpandedChange ?? vi.fn()}
      primaryContent={<button type="button">Потвърди</button>}
      privateContent={<article data-private-dossier="true">Тайна роля: Ясновидка</article>}
      dossierTitle="Ясновидка"
    />
  );
}

describe("PlayActionDock", () => {
  it("keeps the command and private dossier inline on desktop", () => {
    render(dock({ compact: false, expanded: true }));

    const desk = screen.getByRole("region", { name: "Избери цел" });
    const command = screen.getByRole("group", { name: "Текущо действие" });
    const dossier = screen.getByRole("group", { name: "Лично досие" });

    expect(command).toContainElement(screen.getByRole("button", { name: "Потвърди" }));
    expect(dossier).toContainElement(screen.getByText("Тайна роля: Ясновидка"));
    expect(screen.queryByRole("button", { name: "Отвори тайното досие" })).not.toBeInTheDocument();
    expect(desk).toHaveAttribute("data-private-command-desk", "true");
    expect(desk).toHaveAttribute("data-has-private", "true");
  });

  it("keeps the mobile command collapsed until its controlled state expands", async () => {
    const user = userEvent.setup();
    const onExpandedChange = vi.fn();
    const { rerender } = render(dock({ compact: true, expanded: false, onExpandedChange }));

    const commandSurface = screen.getByRole("region", { name: "Избери цел" });
    const showButton = screen.getByRole("button", { name: "Покажи личния ход" });
    expect(commandSurface).toHaveAttribute("data-compact", "true");
    expect(commandSurface).toHaveAttribute("data-expanded", "false");
    expect(showButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Потвърди", hidden: true })).not.toBeVisible();

    await user.click(showButton);
    expect(onExpandedChange).toHaveBeenLastCalledWith(true);

    rerender(dock({ compact: true, expanded: true, onExpandedChange }));
    const hideButton = screen.getByRole("button", { name: "Скрий личния ход" });
    expect(commandSurface).toHaveAttribute("data-expanded", "true");
    expect(hideButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Потвърди" })).toBeVisible();

    await user.click(hideButton);
    expect(onExpandedChange).toHaveBeenLastCalledWith(false);
  });

  it("opens the private role only inside the mobile dossier sheet", async () => {
    const user = userEvent.setup();
    render(dock({ compact: true, expanded: false }));

    expect(screen.queryByText("Тайна роля: Ясновидка")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Ясновидка" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Отвори тайното досие" }));

    const dossier = await screen.findByRole(
      "dialog",
      { name: "Ясновидка" },
      { timeout: 5_000 },
    );
    expect(dossier).toHaveAccessibleDescription("Лично досие с твоята тайна роля и частни сведения.");
    expect(dossier).toContainElement(screen.getByText("Тайна роля: Ясновидка"));

    await user.click(screen.getByRole("button", { name: "Затвори досието" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Ясновидка" })).not.toBeInTheDocument();
    });
  });

  it("uses document scroll normally and a bounded scroller only on short compact viewports", () => {
    const rootRule = dockCss.match(/\.root\.root\s*\{(?<body>[\s\S]*?)\}/)?.groups?.body;
    const contentRule = dockCss.match(/\.primaryColumn,\s*\n\.privateColumn\s*\{(?<body>[\s\S]*?)\}/)?.groups?.body;
    const compactExpandedRule = dockCss.match(/\.root\.root\[data-expanded="true"\]\s*\{(?<body>[\s\S]*?)\}/)?.groups?.body;

    expect(rootRule).toContain("height: auto");
    expect(rootRule).toContain("max-height: none");
    expect(rootRule).toContain("overflow: visible");
    expect(contentRule).not.toMatch(/overflow(?:-y)?:\s*(?:auto|scroll)/);
    expect(compactExpandedRule).toContain("max-height: calc(100svh");
    expect(compactExpandedRule).toContain("overflow-y: auto");
    expect(dockCss).toMatch(/\.root\.root \.primaryColumn[\s\S]*?-webkit-line-clamp:\s*unset/);
  });

  it("joins both desktop zones with a theme-aware material bridge", () => {
    expect(dockCss).toContain(':global(html[data-theme="light"]) .root');
    expect(dockCss).toContain(':global(html[data-theme="dark"]) .root');
    expect(dockCss).toMatch(/\.grid::before\s*\{[\s\S]*?linear-gradient/);
  });

  it("keeps the complete action title visible in the collapsed mobile dock", () => {
    const collapsedTitleRule = playRoomCss.match(
      /:global\(\.play-action-dock\[data-expanded="false"\] \.play-action-dock-head h2\)\s*\{(?<body>[\s\S]*?)\}/,
    )?.groups?.body;

    expect(collapsedTitleRule).toBeDefined();
    expect(collapsedTitleRule).toContain("white-space: normal");
    expect(collapsedTitleRule).not.toContain("text-overflow: ellipsis");
  });
});
