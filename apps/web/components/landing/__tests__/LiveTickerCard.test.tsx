import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LiveTickerCard, type LiveStats } from "@/components/landing/LiveTickerCard";

const families = [
  { family: null, href: "/create", emptyHeading: "Събери първата маса" },
  { family: "werewolves", href: "/werewolf/create", emptyHeading: "Запали първия огън" },
  { family: "mafia", href: "/mafia/create", emptyHeading: "Бъди първият на масата" },
] as const;

const emptyStats: LiveStats = {
  activeRooms: 0,
  connectedPlayers: 0,
  byFamily: { werewolves: 0, mafia: 0 },
};

describe("LiveTickerCard", () => {
  it.each(families)("does not present unavailable $family stats as an empty game", ({ family, href }) => {
    render(<LiveTickerCard family={family} liveStats={null} />);

    expect(screen.getByText(/данните.*временно не са достъпни/i)).toBeVisible();
    expect(screen.queryByText(/първ|няма активни|очакват се гости|сега се играе/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\b0\b/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Създай стая" })).toHaveAttribute("href", href);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each(families)("keeps successful all-zero $family stats distinct from an outage", ({ family, href, emptyHeading }) => {
    render(<LiveTickerCard family={family} liveStats={emptyStats} />);

    expect(screen.getByRole("heading", { name: emptyHeading })).toBeVisible();
    expect(screen.queryByText(/не са достъпни/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Създай стая" })).toHaveAttribute("href", href);
  });

  it.each([
    { family: null, line: "2 села · 1 маса · 19 души" },
    { family: "werewolves", line: "2 села тази вечер" },
    { family: "mafia", line: "1 маса под напрежение" },
  ] as const)("shows healthy $family statistics using the correct family", ({ family, line }) => {
    render(
      <LiveTickerCard
        family={family}
        liveStats={{ activeRooms: 3, connectedPlayers: 19, byFamily: { werewolves: 2, mafia: 1 } }}
      />,
    );

    expect(screen.getByText(line)).toBeVisible();
    expect(screen.getByText("Сега се играе")).toBeVisible();
    expect(screen.queryByText(/не са достъпни/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it.each([
    { activeRooms: 1, connectedPlayers: 1, line: "1 стая · 1 човек" },
    { activeRooms: 2, connectedPlayers: 13, line: "2 стаи · 13 души" },
    { activeRooms: 0, connectedPlayers: 1, line: "0 стаи · 1 човек" },
  ])("uses totals without a family breakdown: $line", ({ activeRooms, connectedPlayers, line }) => {
    render(<LiveTickerCard family={null} liveStats={{ activeRooms, connectedPlayers }} />);

    expect(screen.getByText(line)).toBeVisible();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it.each([
    { family: "mafia", byFamily: { werewolves: 1 }, href: "/mafia/create", body: "Няма активни маси в момента." },
    { family: "mafia", byFamily: { werewolves: 1, mafia: 0 }, href: "/mafia/create", body: "Няма активни маси в момента." },
    { family: "werewolves", byFamily: { mafia: 1 }, href: "/werewolf/create", body: "Няма активни села в момента." },
    { family: "werewolves", byFamily: { mafia: 1, werewolves: 0 }, href: "/werewolf/create", body: "Няма активни села в момента." },
  ] as const)("shows an empty $family family when only the other family has players (%j)", ({ family, byFamily, href, body }) => {
    render(<LiveTickerCard family={family} liveStats={{ activeRooms: 1, connectedPlayers: 8, byFamily }} />);

    expect(screen.getByText(body)).toBeVisible();
    expect(screen.getByRole("link", { name: "Създай стая" })).toHaveAttribute("href", href);
    expect(screen.queryByText("Сега се играе")).not.toBeInTheDocument();
    expect(screen.queryByText(/не са достъпни/i)).not.toBeInTheDocument();
  });

  it.each(["werewolves", "mafia"] as const)("treats an empty breakdown as a known zero for %s", (family) => {
    render(<LiveTickerCard family={family} liveStats={{ activeRooms: 0, connectedPlayers: 1, byFamily: {} }} />);

    expect(screen.getByText(/Няма активни/)).toBeVisible();
    expect(screen.queryByText("Сега се играе")).not.toBeInTheDocument();
  });

  it.each([
    { family: "werewolves", activeRooms: 2, connectedPlayers: 13, line: "2 села тази вечер" },
    { family: "mafia", activeRooms: 2, connectedPlayers: 13, line: "2 маси под напрежение" },
    { family: "werewolves", activeRooms: 0, connectedPlayers: 1, line: "0 села тази вечер" },
    { family: "mafia", activeRooms: 0, connectedPlayers: 1, line: "0 маси под напрежение" },
  ] as const)("preserves the no-breakdown $family fallback: $line", ({ family, activeRooms, connectedPlayers, line }) => {
    render(<LiveTickerCard family={family} liveStats={{ activeRooms, connectedPlayers }} />);

    expect(screen.getByText(line)).toBeVisible();
    expect(screen.getByText("Сега се играе")).toBeVisible();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it.each(["werewolves", "mafia"] as const)("preserves the all-zero %s fallback without a breakdown", (family) => {
    render(<LiveTickerCard family={family} liveStats={{ activeRooms: 0, connectedPlayers: 0 }} />);

    expect(screen.getByText(/Няма активни/)).toBeVisible();
    expect(screen.queryByText("Сега се играе")).not.toBeInTheDocument();
  });

  it("keeps overall homepage activity when only one family has rooms", () => {
    render(<LiveTickerCard family={null} liveStats={{ activeRooms: 1, connectedPlayers: 8, byFamily: { werewolves: 1 } }} />);

    expect(screen.getByText("1 село · 0 маси · 8 души")).toBeVisible();
    expect(screen.getByText("Сега се играе")).toBeVisible();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("replaces unavailable feedback when live data becomes available", () => {
    const { rerender } = render(<LiveTickerCard family={null} liveStats={null} />);

    expect(screen.getByText(/временно не са достъпни/i)).toBeVisible();
    rerender(<LiveTickerCard family={null} liveStats={{ activeRooms: 1, connectedPlayers: 8 }} />);

    expect(screen.getByText("1 стая · 8 души")).toBeVisible();
    expect(screen.queryByText(/не са достъпни/i)).not.toBeInTheDocument();
  });
});
