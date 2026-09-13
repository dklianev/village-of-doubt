import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecentEndingsCard, type Ending } from "@/components/landing/RecentEndingsCard";

const endings: Ending[] = [
  { code: "W12345", family: "werewolves", winnerTeam: "village", endedAt: "2026-09-07T11:50:00Z" },
  { code: "M12345", family: "mafia", winnerTeam: "mafia", endedAt: "2026-09-07T10:00:00Z" },
  { code: "W23456", family: "werewolves", winnerTeam: "werewolves", winnerReasonBg: "Селото остана без защита." },
  { code: "M23456", family: "mafia", winnerTeam: "draw" },
];

const families = [
  { family: null, emptyHeading: "Първите герои ще се появят тук." },
  { family: "werewolves", emptyHeading: "Първите легенди ще се появят тук." },
  { family: "mafia", emptyHeading: "Първите досиета ще се появят тук." },
] as const;

describe("RecentEndingsCard", () => {
  beforeEach(() => {
    vi.spyOn(Date, "now").mockReturnValue(new Date("2026-09-07T12:00:00Z").getTime());
  });

  describe.each(families)("$family availability", ({ family, emptyHeading }) => {
    it.each([{ state: "empty", values: [] }, { state: "populated", values: endings }])("hides $state results and placeholders while unavailable", ({ values }) => {
      render(<RecentEndingsCard family={family} endings={values} available={false} />);

      expect(screen.getByText(/истории.*временно не са достъпни/i)).toBeVisible();
      expect(screen.queryByText(/първ|пример|дело №4821/i)).not.toBeInTheDocument();
      expect(screen.queryByRole("list")).not.toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it.each([undefined, true])("preserves a valid empty result when available is %s", (available) => {
      render(available === undefined
        ? <RecentEndingsCard family={family} endings={[]} />
        : <RecentEndingsCard family={family} endings={[]} available={available} />);

      expect(screen.getByRole("heading", { name: emptyHeading })).toBeVisible();
      expect(screen.getByText("След първата завършена игра.")).toBeVisible();
      expect(screen.queryByText(/не са достъпни/i)).not.toBeInTheDocument();
      expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });
  });

  it("shows only the first three recent endings on the homepage with their real results", () => {
    render(<RecentEndingsCard family={null} endings={endings} />);

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByText(/Стая W12345.*Селото устоя/)).toBeVisible();
    expect(within(rows[0]!).getByText("преди 10 мин.")).toBeVisible();
    expect(within(rows[1]!).getByText("Стая M12345: Мафията пое контрол")).toBeVisible();
    expect(within(rows[1]!).getByText("преди 2 ч.")).toBeVisible();
    expect(within(rows[2]!).getByText(/Стая W23456.*Върколаците надделяха/)).toBeVisible();
    expect(within(rows[2]!).getByText("Селото остана без защита.")).toBeVisible();
    expect(screen.queryByText(/M23456/)).not.toBeInTheDocument();
  });

  it.each([
    { family: "werewolves", codes: ["W12345", "W23456"], excluded: /M12345|M23456/ },
    { family: "mafia", codes: ["M12345", "M23456"], excluded: /W12345|W23456/ },
  ] as const)("filters $family before limiting the list", ({ family, codes, excluded }) => {
    render(<RecentEndingsCard family={family} endings={endings} available />);

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(codes[0]);
    expect(rows[1]).toHaveTextContent(codes[1]);
    expect(screen.queryByText(excluded)).not.toBeInTheDocument();
  });

  it("keeps a successful family-filtered empty result distinct from an outage", () => {
    render(<RecentEndingsCard family="mafia" endings={[endings[0]!]} />);

    expect(screen.getByRole("heading", { name: "Първите досиета ще се появят тук." })).toBeVisible();
    expect(screen.queryByText(/W12345|не са достъпни/i)).not.toBeInTheDocument();
  });

  it("shows real results after availability is restored", () => {
    const { rerender } = render(<RecentEndingsCard family="mafia" endings={endings} available={false} />);

    expect(screen.getByText(/временно не са достъпни/i)).toBeVisible();
    rerender(<RecentEndingsCard family="mafia" endings={endings} available />);

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByText(/не са достъпни/i)).not.toBeInTheDocument();
  });
});
