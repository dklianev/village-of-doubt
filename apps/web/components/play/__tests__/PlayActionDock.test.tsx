import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
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
    />
  );
}

describe("PlayActionDock", () => {
  it("keeps readiness visible when mobile lobby details are collapsed", async () => {
    const ready = vi.fn();
    const expand = vi.fn();
    render(<PlayActionDock
      eyebrow="преди началото" heading="Потвърди готовност" kind="lobby"
      compact expanded={false} onExpandedChange={expand}
      compactSummary={<button onClick={ready}>Готов</button>}
      primaryContent={<button>Копирай покана</button>}
    />);

    expect(screen.getByRole("button", { name: "Готов" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Копирай покана", hidden: true })).not.toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Готов" }));
    expect(ready).toHaveBeenCalledOnce();
    expect(expand).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Покажи подробностите за стаята" }));
    expect(expand).toHaveBeenCalledWith(true);
  });

  it("does not duplicate the compact summary on desktop", () => {
    render(<PlayActionDock
      eyebrow="преди началото" heading="Потвърди готовност" kind="lobby"
      compact={false} expanded={false} onExpandedChange={vi.fn()}
      compactSummary={<button>Готов</button>}
      primaryContent={<button>Готов</button>}
    />);
    expect(screen.getAllByRole("button", { name: "Готов" })).toHaveLength(1);
  });

  it("keeps the desktop command independent from the personal role area", () => {
    render(dock({ compact: false, expanded: true }));

    expect(screen.getByRole("region", { name: "Избери цел" })).toBeVisible();
    const command = screen.getByRole("group", { name: "Текущо действие" });

    expect(command).toContainElement(screen.getByRole("button", { name: "Потвърди" }));
    expect(screen.queryByRole("group", { name: "Лично досие" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Отвори тайното досие" })).not.toBeInTheDocument();
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

  it("does not add a private modal or an extra navigation step to the mobile command", () => {
    render(dock({ compact: true, expanded: false }));

    expect(screen.queryByText("Тайна роля: Ясновидка")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Ясновидка" })).not.toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "Отвори тайното досие" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Покажи личния ход" })).toBeVisible();
  });

  it("uses document scroll normally and a bounded scroller only on short compact viewports", () => {
    const rootRule = dockCss.match(/\.root\.root\s*\{(?<body>[\s\S]*?)\}/)?.groups?.body;
    const contentRule = dockCss.match(/\.primaryColumn\s*\{(?<body>[\s\S]*?)\}/)?.groups?.body;
    const compactExpandedRule = dockCss.match(/\.root\.root\[data-expanded="true"\]\s*\{(?<body>[\s\S]*?)\}/)?.groups?.body;

    expect(rootRule).toContain("height: auto");
    expect(rootRule).toContain("max-height: none");
    expect(rootRule).toContain("overflow: visible");
    expect(contentRule).not.toMatch(/overflow(?:-y)?:\s*(?:auto|scroll)/);
    expect(compactExpandedRule).toContain("max-height: min(42svh, 26rem)");
    expect(compactExpandedRule).toContain("overflow-y: auto");
    expect(dockCss).toMatch(/\.root\.root \.primaryColumn[\s\S]*?-webkit-line-clamp:\s*unset/);
  });

  it("does not collapse desktop actions when the mobile expansion state is false", () => {
    render(dock({ compact: false, expanded: false }));
    const command = screen.getByRole("group", { name: "Текущо действие" });
    expect(command).toBeVisible();
    expect(screen.getByRole("button", { name: "Потвърди" })).toBeVisible();
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
