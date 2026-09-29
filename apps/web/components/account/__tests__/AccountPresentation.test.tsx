import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
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
  afterEach(() => { window.history.replaceState(null, "", "/"); });
  const scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");

  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterAll(() => {
    if (scrollIntoViewDescriptor) {
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", scrollIntoViewDescriptor);
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
    }
  });

  it("показва профила върху отделна илюстрована заглавна секция", () => {
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
    expect(screen.getByRole("banner", { name: "Досие" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Редактирай" })).toHaveAttribute("href", "#account-identity");
    expect(container.querySelector('[data-ds-scene-card]')).not.toBeInTheDocument();
  });

  it("показва празните легенди с връзка към каталога без решетка от заключени печати", () => {
    const { container } = render(<AccountAchievements unlockedIds={[]} total={7} />);

    expect(container.querySelector("[data-account-empty-legends]")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Легенди" })).toBeVisible();
    expect(screen.getByText("Легендите още не са започнали.")).toBeVisible();
    const catalogLink = screen.getByRole("link", { name: /Разгледай легендите/ });
    expect(catalogLink).toBeVisible();
    expect(catalogLink).toHaveAttribute("href", "/achievements");
    expect(container.querySelectorAll("[data-account-locked-legend]").length).toBeLessThanOrEqual(1);
    expect(screen.queryAllByLabelText(/Заключена легенда/i).length).toBeLessThanOrEqual(1);
  });

  it("показва спечелената легенда и обобщава заключените без повтарящи се заместители", () => {
    const { container } = render(<AccountAchievements unlockedIds={["first_blood"]} total={7} />);

    expect(screen.getByRole("heading", { level: 2, name: "Легенди" })).toBeVisible();
    expect(screen.getByText("Първа кръв")).toBeVisible();
    expect(screen.getByText("1 от 7 легенди отключени.")).toBeVisible();
    expect(screen.getByRole("link", { name: /Виж всички легенди/ })).toHaveAttribute("href", "/achievements");
    expect(container.querySelector("[data-account-empty-legends]")).not.toBeInTheDocument();
    expect(container.querySelectorAll("[data-account-locked-legend]").length).toBeLessThanOrEqual(1);
    expect(screen.queryAllByLabelText(/Заключена легенда/i).length).toBeLessThanOrEqual(1);
    const remainder = screen.getAllByText("Още 6 легенди чакат своята вечер.");
    expect(remainder).toHaveLength(1);
    expect(remainder[0]).toBeVisible();
  });

  it("показва три допълнителни показателя без дублиран процент", () => {
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

    expect(screen.getAllByText("Очаква първата игра")).toHaveLength(3);
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

  it("събира export и изтриването в раздела за сигурност", async () => {
    const user = userEvent.setup();
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
    await user.click(screen.getByRole("tab", { name: "Данни и сигурност" }));
    expect(archiveActions).not.toBeNull();
    expect(within(archiveActions as HTMLElement).getByRole("heading", { name: "Твоите данни" })).toBeInTheDocument();
    expect(within(archiveActions as HTMLElement).getByRole("heading", { name: "Опасна зона" })).toBeInTheDocument();
  });

  it("подрежда mobile досието в три семантични раздела", async () => {
    const user = userEvent.setup();
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

    const groups = container.querySelectorAll("[data-account-section]");
    expect(groups).toHaveLength(3);
    expect(screen.getByRole("tab", { name: "Хроника" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Образ и достъп" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: "Данни и сигурност" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByText("Хроника")).toBeInTheDocument();
    expect(screen.getByText("Образ и достъп")).toBeInTheDocument();
    expect(screen.getByText("Данни и сигурност")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Образ и достъп" }));
    expect(screen.getByRole("tab", { name: "Хроника" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: "Образ и достъп" })).toHaveAttribute("aria-selected", "true");
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

  it("представя филтрите за портрети като независими натиснати бутони", () => {
    render(
      <AccountProfile
        email="visual@example.com"
        initialName="Визуален играч"
        initialAvatarId="portrait-f04"
        emailVerified
        providers={["credential"]}
      />,
    );

    const all = screen.getByRole("button", { name: "Всички" });
    expect(all).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("изключва отказа, докато необратимото изтриване се изпълнява", async () => {
    const user = userEvent.setup();
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.open = true;
      },
    });
    vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise(() => {}));
    render(<AccountDangerZone email="visual@example.com" />);

    await user.click(screen.getByRole("button", { name: "Изтрий моето досие" }));
    await user.type(screen.getByLabelText("Напиши ИЗТРИЙ за потвърждение"), "ИЗТРИЙ");
    await user.click(screen.getByRole("button", { name: "Изтрий завинаги" }));

    expect(screen.getByRole("button", { name: "Отказ" })).toBeDisabled();
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
