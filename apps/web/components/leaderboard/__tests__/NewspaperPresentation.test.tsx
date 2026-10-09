import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { fixtureLeaderboard } from "@/app/leaderboard/leaderboard-fixture";
import { NewspaperEmpty } from "../NewspaperEmpty";
import { NewspaperPage } from "../NewspaperPage";
import { NewspaperUnavailable } from "../NewspaperUnavailable";

describe("newspaper presentation", () => {
  it.each([1, 2, 3, 30])("renders every player exactly once in one ranking with %i entries", (count) => {
    const entries = fixtureLeaderboard(count);
    const { container } = render(<NewspaperPage entries={entries} />);
    const ranking = screen.getByRole("table", { name: "Класиране" });
    const rows = within(ranking).getAllByRole("row");
    expect(screen.getAllByRole("table")).toHaveLength(1);
    expect(rows).toHaveLength(count + 1);
    expect(within(rows[0]!).getAllByRole("columnheader").map((cell) => cell.getAttribute("aria-label") || cell.textContent)).toEqual([
      "Място", "Играч", "Победи", "Игри", "Процент победи",
    ]);
    expect(rows.slice(1).map((row) => within(row).getByRole("rowheader").textContent)).toEqual(entries.map((entry) => entry.displayName));
    expect(rows.slice(1).map((row) => within(row).getAllByRole("cell").map((cell) => cell.textContent))).toEqual(
      entries.map((entry, index) => [String(index + 1), String(entry.wins), String(entry.games), `${Math.round(entry.wins / entry.games * 100)}%`]),
    );
    expect(screen.getAllByRole("region", { name: "Начело на броя" })).toHaveLength(1);
    expect(container.querySelector(".headline-main")!.compareDocumentPosition(ranking) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelectorAll("tbody tr[data-leading]")).toHaveLength(1);
    const runners = Array.from(container.querySelectorAll<HTMLElement>(".headline-runner"));
    expect(runners).toHaveLength(Math.min(2, count - 1));
    expect(runners.map((runner) => runner.querySelector("bdi")?.textContent)).toEqual(entries.slice(1, 3).map((entry) => entry.displayName));
    expect(container.querySelector(".headline-portrait, .headline-main img")).toBeNull();
  });

  it("preserves authoritative input order and separate players with the same display name", () => {
    const entries = [
      { id: "leader", displayName: "Мила", games: 1, wins: 0, lastPlayed: null },
      { id: "b", displayName: "Борис", games: 4, wins: 2, lastPlayed: null },
      { id: "a", displayName: "Борис", games: 4, wins: 3, lastPlayed: null },
      { id: "fourth", displayName: "Калоян", games: 9, wins: 8, lastPlayed: null },
    ];
    const original = entries.map((entry) => ({ ...entry }));
    entries.forEach(Object.freeze);
    Object.freeze(entries);
    const { container } = render(<NewspaperPage entries={entries} />);
    expect(screen.getAllByRole("rowheader", { name: "Борис" })).toHaveLength(2);
    expect(screen.getAllByRole("row").slice(1).map((row) => row.textContent)).toEqual(["1Мила010%", "2Борис2450%", "3Борис3475%", "4Калоян8989%"]);
    expect(screen.getByRole("heading", { name: "Мила оглавява броя" })).toBeInTheDocument();
    const runners = container.querySelectorAll(".headline-runner");
    expect(runners).toHaveLength(2);
    expect(runners[0]).toHaveTextContent(/Борис\s*2 победи/);
    expect(runners[1]).toHaveTextContent(/Борис\s*3 победи/);
    expect(entries).toEqual(original);
  });

  it("updates the headline and runners when the authoritative order changes", () => {
    const entries = fixtureLeaderboard(3);
    const { container, rerender } = render(<NewspaperPage entries={entries} />);
    const reordered = [entries[2]!, entries[0]!, entries[1]!];
    rerender(<NewspaperPage entries={reordered} />);
    expect(screen.getByRole("heading", { name: `${reordered[0]!.displayName} оглавява броя` })).toBeInTheDocument();
    expect(Array.from(container.querySelectorAll(".headline-runner bdi"), (node) => node.textContent)).toEqual(reordered.slice(1).map((entry) => entry.displayName));
    expect(screen.getAllByRole("rowheader").map((node) => node.textContent)).toEqual(reordered.map((entry) => entry.displayName));
  });

  it("preserves and isolates long, bidi, and markup-like table names", () => {
    const names = ["Александра Константинополска".repeat(3), "ليلى 42", "אביב <script>име</script>"];
    const entries = fixtureLeaderboard(3).map((entry, index) => ({ ...entry, displayName: names[index]! }));
    render(<NewspaperPage entries={entries} />);
    const headers = screen.getAllByRole("rowheader");
    expect(headers.map((node) => node.textContent)).toEqual(names);
    headers.forEach((node, index) => {
      expect(node.querySelector("bdi")?.textContent).toBe(names[index]);
      expect(node.querySelector("script")).toBeNull();
    });
  });

  it("keeps the complete table in a named keyboard-accessible scroll region", () => {
    render(<NewspaperPage entries={fixtureLeaderboard(30)} />);
    const region = screen.getByRole("region", { name: "Класиране на играчите" });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(within(region).getByRole("table", { name: "Класиране" })).toBeInTheDocument();
    expect(within(region).getAllByRole("rowheader")).toHaveLength(30);
    expect(within(region).getByRole("table").querySelector("caption")).toHaveTextContent("Класиране");
  });

  it("names the ranking scope and snapshot without inventing an edition number", () => {
    const { container } = render(<NewspaperPage entries={fixtureLeaderboard(1)} asOf={new Date("2026-09-17T19:00:00Z")} />);
    expect(screen.getByText("Последните 7 дни")).toBeInTheDocument();
    expect(screen.getByText("Публични завършени игри")).toBeInTheDocument();
    expect(screen.getByRole("table")).toHaveAccessibleDescription(/Подредбата е по победи/);
    const times = container.querySelectorAll("time");
    expect(times.length).toBeGreaterThan(0);
    times.forEach((time) => expect(time).toHaveAttribute("dateTime", "2026-09-17T19:00:00.000Z"));
    expect(screen.queryByText(/Брой №/)).not.toBeInTheDocument();
  });

  it("does not invent a snapshot date when no asOf value was supplied", () => {
    const { container } = render(<NewspaperPage entries={fixtureLeaderboard(1)} />);
    expect(container.querySelector("time")).toBeNull();
    expect(screen.queryByText(/Данни към|Брой №/)).not.toBeInTheDocument();
  });

  it("names empty eligibility without claiming private games will populate it", () => {
    const { container } = render(<NewspaperEmpty />);
    expect(screen.getByRole("heading", { name: "Още няма класирани играчи" })).toBeInTheDocument();
    expect(screen.getByText(/Частните игри не участват/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Създай стая" })).toHaveAttribute("href", "/werewolf/create");
    expect(container.querySelector(".skeleton, .empty-press-proof")).toBeNull();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(container.querySelector("time, .headline-runner")).toBeNull();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("reports unavailable data separately, with retry and no unsupported standings claim", () => {
    const { container } = render(<NewspaperUnavailable />);
    expect(screen.getByRole("alert")).toHaveTextContent("Класацията временно е недостъпна");
    expect(screen.queryByText(/Още няма класирани|Класацията не е празна/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Опитай отново" })).toHaveAttribute("href", "/leaderboard");
    expect(screen.getByRole("link", { name: "Към началото" })).toHaveAttribute("href", "/");
    expect(container.querySelector("time, .headline-runner")).toBeNull();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
