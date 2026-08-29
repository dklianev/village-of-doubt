import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AccountAchievements } from "../AccountAchievements";
import { AccountDashboard } from "../AccountDashboard";
import { AccountDataExport } from "../AccountDataExport";
import { AccountDangerZone } from "../AccountDangerZone";
import { AccountHero } from "../AccountHero";
import { AccountProfile } from "../AccountProfile";
import { AccountStats } from "../AccountStats";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    updateUser: vi.fn(async () => ({ data: {}, error: null })),
    signOut: vi.fn(async () => ({ data: {}, error: null })),
  },
}));

describe("account presentation", () => {
  it("използва сценичния primitive и account art token за заглавното досие", () => {
    const { container } = render(
      <AccountHero
        userId="visual-account-user"
        name="Визуален играч"
        avatarId="portrait-f04"
        memberSince={new Date("2026-03-10T10:00:00.000Z")}
        totalGames={8}
        totalWins={5}
        winRate={63}
        activityState="ready"
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Визуален играч" })).toBeInTheDocument();
    expect(container.querySelector('[data-ds-scene-card="sm"]')).toBeInTheDocument();
    expect(container.querySelector("[data-ds-scene-card-background]")).toHaveStyle({
      backgroundImage: expect.stringContaining("var(--art-account)"),
    });
  });

  it("представя празните легенди като архивен vault", () => {
    const { container } = render(<AccountAchievements unlockedIds={[]} total={7} />);

    expect(container.querySelector("[data-account-empty-legends]")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-account-locked-legend]")).toHaveLength(7);
    expect(screen.getByText("Легендите още не са започнали.")).toBeInTheDocument();
  });

  it("показва заключените легенди като сухи архивни печати", () => {
    render(<AccountAchievements unlockedIds={["first_blood"]} total={7} />);

    expect(screen.getAllByLabelText("Заключена легенда")).toHaveLength(6);
  });

  it("представя празната статистика като четири очакващи регистрови фиша", () => {
    render(
      <AccountStats
        activityState="empty"
        stats={{
          totalGames: 0,
          totalWins: 0,
          winRate: 0,
          villageWins: 0,
          threatWins: 0,
          longestStreak: 0,
          memberSince: null,
        }}
      />,
    );

    expect(screen.getAllByText("Очаква първата игра")).toHaveLength(4);
  });

  it("управлява образите като roving radiogroup с клавиатура", async () => {
    const user = userEvent.setup();
    render(
      <AccountProfile
        initialName="Визуален играч"
        initialAvatarId="portrait-f04"
        email="visual@example.com"
        emailVerified
        providers={["credential"]}
      />,
    );

    const group = screen.getByRole("radiogroup", { name: "Избери образ" });
    const selected = within(group).getByRole("radio", { name: "Архиварката" });
    const next = within(group).getByRole("radio", { name: "Стопанката" });

    expect(selected).toHaveAttribute("aria-checked", "true");
    expect(selected).toHaveAttribute("tabindex", "0");
    expect(next).toHaveAttribute("tabindex", "-1");

    selected.focus();
    await user.keyboard("{ArrowRight}");

    expect(next).toHaveFocus();
    expect(next).toHaveAttribute("aria-checked", "true");

    selected.focus();
    await user.keyboard(" ");

    expect(selected).toHaveAttribute("aria-checked", "true");
  });

  it("събира export и унищожаването в една архивна лента", () => {
    const { container } = render(
      <AccountDashboard
        userId="visual-account-user"
        email="visual@example.com"
        name="Визуален играч"
        avatarId="portrait-f04"
        emailVerified
        providers={["credential"]}
        activityState="empty"
        stats={{
          totalGames: 0,
          totalWins: 0,
          winRate: 0,
          villageWins: 0,
          threatWins: 0,
          longestStreak: 0,
          memberSince: null,
        }}
        recentGames={[]}
        unlockedAchievementIds={[]}
        totalAchievementCount={7}
      />,
    );

    const archiveActions = container.querySelector("[data-account-archive-actions]");
    expect(archiveActions).not.toBeNull();
    expect(within(archiveActions as HTMLElement).getByRole("heading", { name: "Твоите данни" })).toBeInTheDocument();
    expect(within(archiveActions as HTMLElement).getByRole("heading", { name: "Опасна зона" })).toBeInTheDocument();
  });

  it("използва Pill за командата за изтегляне", () => {
    render(<AccountDataExport />);

    expect(screen.getByRole("button", { name: "Изтегли моите данни (JSON)" })).toHaveAttribute(
      "data-ds-pill",
      "secondary",
    );
  });

  it("дава достъпно име на диалога за изтриване", async () => {
    const user = userEvent.setup();
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = true;
      },
    });
    render(<AccountDangerZone email="visual@example.com" />);

    await user.click(screen.getByRole("button", { name: "Изтрий моето досие" }));

    expect(screen.getByRole("dialog", { name: "Сигурен/сигурна ли си?" })).toBeInTheDocument();
  });

  it("регистрира scoped account CSS без legacy остров", () => {
    const accountSources = [
      "app/account/page.tsx",
      "components/account/AccountDashboard.tsx",
      "components/account/AccountHero.tsx",
      "components/account/AccountProfile.tsx",
    ].map((path) => readFileSync(resolve(process.cwd(), path), "utf8")).join("\n");
    const regression = readFileSync(resolve(process.cwd(), "../../scripts/regression.mjs"), "utf8");

    expect(accountSources).toContain("Account.module.css");
    expect(accountSources).not.toContain("LegacyAccount.module.css");
    expect(regression).toContain("apps/web/components/account/Account.module.css");
    expect(regression).not.toContain("apps/web/components/account/LegacyAccount.module.css");
  });
});
