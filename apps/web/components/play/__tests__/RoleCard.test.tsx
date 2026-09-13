import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getRoleShortDescriptionBg } from "@werewolf/shared";
import { describe, expect, it } from "vitest";
import { RoleCard } from "@/components/play/RoleCard";
import { ROLE_GUIDE_BG } from "@/lib/play/private-copy";
import type { PrivateResult, PublicPlayer } from "@/lib/play/types";

const roleCardCss = readFileSync(resolve(process.cwd(), "components/play/RoleCard.module.css"), "utf8");

function player(overrides: Partial<PublicPlayer> = {}): PublicPlayer {
  return {
    userId: "u1",
    displayName: "Анна",
    connected: true,
    ready: true,
    playing: true,
    alive: true,
    host: false,
    narrator: false,
    acceptedFullNarrator: true,
    mayor: false,
    hasVoted: false,
    actedThisPhase: false,
    revealedRole: "",
    ...overrides,
  };
}

const players = [
  player({ userId: "u1", displayName: "Анна" }),
  player({ userId: "u2", displayName: "Борис" }),
];

describe("RoleCard", () => {
  it.each([
    ["seer", "Ясновидка", "werewolves"],
    ["commissioner", "Комисар", "mafia"],
  ] as const)("keeps mini %s identity and latest private result visible independently of the guide", async (code, name, family) => {
    const user = userEvent.setup();
    const props = { role: { role: code, roleNameBg: name }, family, players, presentation: "mini" } as const;
    const { rerender } = render(<RoleCard {...props} result={{ targetUserId: "u2", isEvil: true }} />);
    const guide = ROLE_GUIDE_BG[code]!;

    expect(screen.getByRole("heading", { name })).toBeVisible();
    expect(screen.getByText(guide.team)).toBeVisible();
    expect(screen.getByText("За ролята")).toBeVisible();
    expect(screen.getByText(guide.summary)).not.toBeVisible();
    expect(screen.getByText("Борис е от злата страна.")).toBeVisible();
    expect(screen.getByText("Резултат от проверката")).toBeVisible();
    expect(screen.getByText("За ролята").closest("details")).not.toContainElement(screen.getByRole("status"));
    expect(screen.getByText(guide.timing)).not.toBeVisible();
    expect(screen.getByText(guide.win)).not.toBeVisible();

    rerender(<RoleCard {...props} result={{ targetUserId: "u1", isEvil: false }} />);
    expect(screen.queryByText("Борис е от злата страна.")).not.toBeInTheDocument();
    expect(screen.getByText("Анна не е от злата страна.")).toBeVisible();
    await user.click(screen.getByText("За ролята"));
    expect(screen.getByText(guide.summary)).toBeVisible();
    expect(screen.getByText("Резултат от проверката")).toBeVisible();
    expect(screen.getByRole("status", { name: "Личен резултат" })).toHaveTextContent("Анна не е от злата страна.");
    expect(screen.getByText(guide.timing)).toBeVisible();
    expect(screen.getByText(guide.win)).toBeVisible();
    await user.click(screen.getByText("За ролята"));
    expect(screen.getByText("Анна не е от злата страна.")).toBeVisible();
    expect(screen.getByText("Резултат от проверката")).toBeVisible();
  });

  it.each([
    ["seer", "Ясновидка", "werewolves"],
    ["commissioner", "Комисар", "mafia"],
  ] as const)("keeps compact %s identity and private result visible outside closed role details", (code, name, family) => {
    const { container } = render(
      <RoleCard
        presentation="compact"
        role={{ role: code, roleNameBg: name }}
        result={{ targetUserId: "u2", isEvil: true }}
        players={players}
        family={family}
      />,
    );

    const guide = ROLE_GUIDE_BG[code]!;
    const details = screen.getByText("За ролята").closest("details");
    expect(details).not.toHaveAttribute("open");
    expect(screen.getByText("само за теб")).toBeVisible();
    expect(screen.getByRole("heading", { name })).toBeVisible();
    expect(screen.getByText(guide.team)).toBeVisible();
    expect(screen.getByText(guide.summary)).toBeVisible();
    expect(screen.getByText(guide.timing)).not.toBeVisible();
    expect(screen.getByText(guide.win)).not.toBeVisible();
    const result = screen.getByRole("status", { name: "Личен резултат" });
    expect(result).toBeVisible();
    expect(within(result).getByText("Резултат от проверката")).toBeVisible();
    expect(result).toHaveTextContent("Борис е от злата страна.");
    expect(details).not.toContainElement(result);
    expect(screen.getByRole("article", { name: `Тайна роля: ${name}` })).toHaveAttribute("data-role-family", family);
    expect(container.querySelectorAll("article")).toHaveLength(1);
    expect(screen.queryByText("Анна")).not.toBeInTheDocument();
  });

  it("updates the compact private result without opening the role details", () => {
    const props = { role: { role: "seer", roleNameBg: "Ясновидка" }, players, presentation: "compact" } as const;
    const { rerender } = render(<RoleCard {...props} result={null} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText("Резултат от проверката")).not.toBeInTheDocument();

    rerender(<RoleCard {...props} result={{ targetUserId: "u2", isEvil: true }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Борис е от злата страна.");

    rerender(<RoleCard {...props} result={{ targetUserId: "u1", isEvil: false }} />);
    expect(screen.getByRole("status")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Анна не е от злата страна.");
    expect(screen.queryByText("Борис е от злата страна.")).not.toBeInTheDocument();
    expect(screen.getByText("За ролята").closest("details")).not.toHaveAttribute("open");
  });

  it.each(["full", "compact", "mini"] as const)("keeps %s content hidden without a server-supplied private role", (presentation) => {
    const { container } = render(
      <RoleCard presentation={presentation} role={null} result={{ targetUserId: "u2", isEvil: true }} players={players} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("toggles compact timing and goal while keeping the private result visible", async () => {
    const user = userEvent.setup();
    render(
      <RoleCard
        presentation="compact"
        role={{ role: "seer", roleNameBg: "Ясновидка" }}
        result={{ targetUserId: "u2", isEvil: true }}
        players={players}
      />,
    );

    await user.tab();
    expect(screen.getByText("За ролята")).toHaveFocus();
    await user.click(screen.getByText("За ролята"));
    expect(screen.getByText("Кога действа")).toBeVisible();
    expect(screen.getByText("Цел")).toBeVisible();
    expect(screen.getByRole("status")).toBeVisible();
    await user.click(screen.getByText("За ролята"));
    expect(screen.getByText("Кога действа")).not.toBeVisible();
    expect(screen.getByRole("status")).toBeVisible();
  });

  it("uses the existing role description and family team for a compact role without a private guide", () => {
    render(
      <RoleCard
        presentation="compact"
        role={{ role: "doctor", roleNameBg: "Доктор" }}
        result={null}
        players={players}
        family="mafia"
      />,
    );

    expect(screen.getByText(getRoleShortDescriptionBg("doctor"))).toBeVisible();
    expect(screen.getByText("Град")).toBeVisible();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("keeps explicit full presentation identical to the default", () => {
    const props = { role: { role: "seer", roleNameBg: "Ясновидка" }, result: { targetUserId: "u2", isEvil: true }, players } as const;
    const { container, rerender } = render(<RoleCard {...props} />);
    const defaultMarkup = container.innerHTML;
    rerender(<RoleCard {...props} presentation="full" />);
    expect(container.innerHTML).toBe(defaultMarkup);
    expect(screen.getByText("Кога действа")).toBeVisible();
    expect(screen.getByText("Цел")).toBeVisible();
    expect(screen.queryByText("За ролята")).not.toBeInTheDocument();
  });

  it("stays hidden until the server sends the private role", () => {
    const { container } = render(<RoleCard role={null} result={null} players={players} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders the private role guide as a private dossier without implementation copy", () => {
    render(<RoleCard role={{ role: "seer", roleNameBg: "Ясновидка" }} result={null} players={players} />);

    expect(screen.getByText("само за теб")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ясновидка" })).toBeInTheDocument();
    expect(screen.getByText("Отбор")).toBeInTheDocument();
    expect(screen.getByText("Кога действа")).toBeInTheDocument();
    expect(screen.getByText("Цел")).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Тайна роля: Ясновидка" })).toHaveAttribute("data-private-dossier", "true");
    expect(screen.queryByText(/публичното състояние|инструментите на браузъра|мрежовите заявки/)).not.toBeInTheDocument();
  });

  it("formats private investigation results against the public player list", () => {
    render(
      <RoleCard
        role={{ role: "commissioner", roleNameBg: "Комисар" }}
        result={{ targetUserId: "u2", isEvil: true }}
        players={players}
      />,
    );

    const result = screen.getByRole("status", { name: "Личен резултат" });
    expect(result).toHaveTextContent("Борис е от злата страна.");
    expect(result.compareDocumentPosition(screen.getByText("Отбор")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("does not announce a result until a private result arrives", () => {
    render(<RoleCard role={{ role: "seer", roleNameBg: "Ясновидка" }} result={null} players={players} />);

    expect(screen.queryByRole("status", { name: "Личен резултат" })).not.toBeInTheDocument();
    expect(screen.queryByText("Резултат от проверката")).not.toBeInTheDocument();
  });

  it.each([
    [{ targetUserId: "u2", isEvil: true }, "Борис е от злата страна."],
    [{ targetUserId: "u2", isEvil: false }, "Борис не е от злата страна."],
    [{ targetUserId: "u2", role: "werewolf" }, "Борис е Върколак."],
    [{ targetUserId: "u2", isCommissioner: true }, "Борис е Комисарят."],
    [{ targetUserId: "u2", isCommissioner: false }, "Борис не е Комисарят."],
    [{ targetUserId: "u2", messageBg: "Няма следа.", isEvil: true }, "Проверката е за Борис. Няма следа."],
    [{ targetUserId: "", messageBg: "Няма следа." }, "Няма следа."],
    [{ targetUserId: "u1", targetUserIds: ["u1", "u2"], messageBg: "Няма следа." }, "Проверката е за групата Анна, Борис. Няма следа."],
    [{ targetUserId: "u1", targetUserIds: ["u1", "u2"] }, "Имаш резултат за групата Анна, Борис."],
    [{ targetUserId: "missing" }, "Имаш резултат за избрания играч."],
  ] satisfies [PrivateResult, string][])("labels private result %j without adding a team, round or timestamp", (result, expected) => {
    render(<RoleCard role={{ role: "commissioner", roleNameBg: "Комисар" }} family="mafia" result={result} players={players} />);

    const status = screen.getByRole("status", { name: "Личен резултат" });
    expect(within(status).getByText("Резултат от проверката")).toBeVisible();
    expect(within(status).getByText(expected)).toBeVisible();
    expect(status.textContent).toBe(`Резултат от проверката ${expected}`);
  });

  describe.each(["full", "compact", "mini"] as const)("%s team identity", (presentation) => {
    it.each([
      ["civilian", "Мирен гражданин", "mafia", "village"],
      ["commissioner", "Комисар", "mafia", "village"],
      ["seer", "Ясновидка", "werewolves", "village"],
      ["mafioso", "Мафиот", "mafia", "mafia"],
      ["werewolf", "Върколак", "werewolves", "werewolves"],
      ["vampire", "Вампир", "werewolves", "vampires"],
      ["jester", "Шут", "mafia", "neutral"],
    ] as const)("uses %s's own team independently of the game family and result", (code, name, family, team) => {
      render(<RoleCard role={{ role: code, roleNameBg: name }} presentation={presentation} family={family} result={{ targetUserId: "u2", isEvil: true }} players={players} />);

      const card = screen.getByRole("article", { name: `Тайна роля: ${name}` });
      expect(card).toHaveAttribute("data-role-team", team);
      expect(card).toHaveAttribute("data-role-family", family);
    });
  });

  it("uses the active game family for roles shared by both games", () => {
    const { container } = render(
      <RoleCard
        role={{ role: "jester", roleNameBg: "Шут" }}
        result={null}
        players={players}
        family="mafia"
      />,
    );

    expect(container.querySelector('[data-role-family="mafia"]')).toBeInTheDocument();
  });

  it("uses the full role artwork inside a seamless theme-aware dossier", () => {
    render(<RoleCard role={{ role: "seer", roleNameBg: "Ясновидка" }} result={null} players={players} />);

    const dossier = screen.getByRole("article", { name: "Тайна роля: Ясновидка" });
    expect(dossier.getAttribute("style")).toContain('/game-art/role-seer.webp');
    expect(dossier.getAttribute("style")).not.toContain('/thumbs/');
    expect(roleCardCss).toMatch(/\.art\s*\{[\s\S]*?mask-image:\s*linear-gradient/);
    expect(roleCardCss).toContain(':global(html[data-theme="light"]) .dossier');
    expect(roleCardCss).toContain(':global(html[data-theme="dark"]) .dossier');
    expect(roleCardCss).not.toMatch(/overflow-y:\s*(?:auto|scroll)/);
  });
});
