import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LeaderboardEntry } from "@/lib/leaderboard-headlines";
import { MainHeadline } from "../MainHeadline";

const leader: LeaderboardEntry = { id: "leader", displayName: "Мила", games: 5, wins: 5, lastPlayed: null };

describe("MainHeadline", () => {
  it("keeps time-scoped results without a fictional player portrait or extra statistics panel", () => {
    const { container } = render(<MainHeadline entry={leader} />);
    expect(screen.getByRole("heading", { name: "Мила оглавява броя" })).toBeInTheDocument();
    expect(screen.getByText("5 победи от 5 игри за последните 7 дни.")).toBeInTheDocument();
    expect(container.querySelector("dl")).toBeNull();
    expect(container.querySelector("img, .headline-portrait")).toBeNull();
    expect(screen.queryByText("Илюстрация")).not.toBeInTheDocument();
  });

  it("does not turn one win this week into a debut", () => {
    render(<MainHeadline entry={{ displayName: "Анна", games: 1, wins: 1, lastPlayed: null }} />);
    expect(screen.getByText("1 победа от 1 игра за последните 7 дни.")).toBeInTheDocument();
    expect(screen.queryByText(/Дебют|Първа победа/)).not.toBeInTheDocument();
  });

  it.each([false, true])("does not fabricate runners with an explicitly empty list: %s", (explicit) => {
    const { container } = render(explicit ? <MainHeadline entry={leader} runnersUp={[]} /> : <MainHeadline entry={leader} />);
    expect(container.querySelector(".headline-runners")).toBeNull();
    expect(container.querySelectorAll(".headline-runner")).toHaveLength(0);
  });

  it.each([1, 2])("shows exactly %i supplied runners in their input order", (count) => {
    const runnersUp = [
      { id: "second", displayName: "Втори", games: 3, wins: 1, lastPlayed: null },
      { id: "third", displayName: "Трети", games: 9, wins: 7, lastPlayed: null },
    ].slice(0, count);
    const { container } = render(<MainHeadline entry={leader} runnersUp={runnersUp} />);
    const runners = Array.from(container.querySelectorAll<HTMLElement>(".headline-runners .headline-runner"));
    expect(runners).toHaveLength(count);
    expect(screen.getByRole("list", { name: "След водача" })).toHaveAttribute("start", "2");
    expect(screen.getAllByRole("listitem")).toHaveLength(count);
    runners.forEach((runner, index) => {
      expect(within(runner).getByText(runnersUp[index]!.displayName, { exact: true })).toBeInTheDocument();
      expect(runner).toHaveTextContent(new RegExp(`^0?${index + 2}\\s*`));
      expect(within(runner).queryByText(leader.displayName, { exact: true })).not.toBeInTheDocument();
    });
  });

  it.each([
    [0, "0 победи"],
    [1, "1 победа"],
    [2, "2 победи"],
    [11, "11 победи"],
  ] as const)("uses the correct Bulgarian win form for a runner with %i wins", (wins, copy) => {
    const { container } = render(<MainHeadline entry={leader} runnersUp={[
      { id: "runner", displayName: "Анна", games: 12, wins, lastPlayed: null },
    ]} />);
    const runner = container.querySelector<HTMLElement>(".headline-runner")!;
    expect(runner).toHaveTextContent(copy);
    expect(runner).not.toHaveTextContent(wins === 1 ? /1 победи/ : new RegExp(`${wins} победа(?:\\s|$)`));
  });

  it("retains duplicate display names as separate runners with their own results", () => {
    const { container } = render(<MainHeadline entry={leader} runnersUp={[
      { id: "b", displayName: "Борис", games: 4, wins: 1, lastPlayed: null },
      { id: "a", displayName: "Борис", games: 7, wins: 5, lastPlayed: null },
    ]} />);
    const runners = container.querySelectorAll(".headline-runner");
    expect(runners).toHaveLength(2);
    expect(runners[0]).toHaveTextContent(/Борис\s*1 победа/);
    expect(runners[1]).toHaveTextContent(/Борис\s*5 победи/);
  });

  it("does not promote a fourth participant into the runners list", () => {
    const { container } = render(<MainHeadline entry={leader} runnersUp={[
      { ...leader, id: "second", displayName: "Втори" },
      { ...leader, id: "third", displayName: "Трети" },
      { ...leader, id: "fourth", displayName: "Четвърти" },
    ]} />);
    expect(container.querySelectorAll(".headline-runner")).toHaveLength(2);
    expect(screen.queryByText("Четвърти")).not.toBeInTheDocument();
  });

  it("keeps long and bidirectional names intact and isolated from ranks and copy", () => {
    const names = ["АлександърБезИнтервалиЗаПроверка".repeat(3), "ليلى 42", "אביב <b>име</b>"];
    const { container } = render(<MainHeadline
      entry={{ ...leader, displayName: names[0]! }}
      runnersUp={names.slice(1).map((displayName, index) => ({ ...leader, id: `runner-${index}`, displayName }))}
    />);
    expect(Array.from(container.querySelectorAll("bdi"), (node) => node.textContent)).toEqual(names);
    expect(container.querySelector("bdi b")).toBeNull();
    expect(screen.getByRole("heading", { name: `${names[0]} оглавява броя` })).toBeInTheDocument();
  });
});
