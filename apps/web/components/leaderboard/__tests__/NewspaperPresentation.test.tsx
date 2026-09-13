import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NewspaperEmpty } from "../NewspaperEmpty";
import { NewspaperPage } from "../NewspaperPage";
import { NewspaperUnavailable } from "../NewspaperUnavailable";

const entries = [
  { id: "first", displayName: "Мила", games: 9, wins: 8, lastPlayed: null },
  { id: "second", displayName: "Калоян", games: 11, wins: 7, lastPlayed: null },
  { id: "third", displayName: "Ива", games: 8, wins: 5, lastPlayed: null },
  { id: "fourth", displayName: "Борис", games: 10, wins: 5, lastPlayed: null },
];

describe("newspaper presentation", () => {
  it("places a labelled top-three ranking before the editorial portrait without reordering results", () => {
    const { container } = render(<NewspaperPage entries={entries} issueCount={18} />);
    const ranking = screen.getByRole("table", { name: "Начело на класацията" });
    const rows = within(ranking).getAllByRole("row");

    expect(rows).toHaveLength(4);
    expect(within(rows[0]!).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "Място", "Играч", "Победи", "Вечери",
    ]);
    expect(rows.slice(1).map((row) => row.textContent)).toEqual(["1Мила89", "2Калоян711", "3Ива58"]);
    expect(ranking.compareDocumentPosition(container.querySelector("figure")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("region", { name: "Класирани играчи" })).toHaveTextContent("Борис");
  });

  it("does not invent podium places when only one player is ranked", () => {
    render(<NewspaperPage entries={entries.slice(0, 1)} issueCount={1} />);

    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
  });

  it("names the empty state and offers a concrete new-table action", () => {
    render(<NewspaperEmpty />);

    expect(screen.getByRole("heading", { name: "Още няма класирани играчи" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Създай стая" })).toHaveAttribute("href", "/werewolf/create");
  });

  it("reports unavailable data without making an unsupported claim about the standings", () => {
    render(<NewspaperUnavailable />);

    expect(screen.getByRole("alert")).toHaveTextContent("Класацията временно е недостъпна");
    expect(screen.queryByText(/Класацията не е празна/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Опитай отново" })).toHaveAttribute("href", "/leaderboard");
  });
});
