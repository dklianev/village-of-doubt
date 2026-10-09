import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Masthead } from "../Masthead";

describe("Masthead", () => {
  it("names the ranking scope without fabricating a date or edition number", () => {
    const { container } = render(<Masthead />);
    expect(screen.getByRole("heading", { level: 1, name: "Вечерен брой" })).toBeInTheDocument();
    expect(screen.getByText("Последните 7 дни")).toBeInTheDocument();
    expect(screen.getByText("Публични завършени игри")).toBeInTheDocument();
    expect(container.querySelector("time")).toBeNull();
    expect(container).not.toHaveTextContent(/Брой №|22\.09\.2026/);
  });

  it.each([
    ["2026-09-17T22:30:00.000Z", /18(?:\.09\.|\s+септември\s+)2026/],
    ["2026-01-17T22:30:00.000Z", /18(?:\.01\.|\s+януари\s+)2026/],
  ] as const)("uses the supplied snapshot's Sofia calendar date: %s", (iso, dateText) => {
    const { container } = render(<Masthead asOf={new Date(iso)} />);
    const time = container.querySelector("time");
    expect(time).toHaveAttribute("dateTime", iso);
    expect(time).toHaveTextContent(dateText);
    expect(container).not.toHaveTextContent(/Брой №/);
  });

  it("removes a previous snapshot date when the next edition has no snapshot", () => {
    const { container, rerender } = render(<Masthead asOf={new Date("2026-09-17T19:00:00.000Z")} />);
    expect(container.querySelector("time")).toBeInTheDocument();
    rerender(<Masthead />);
    expect(container.querySelector("time")).toBeNull();
  });
});
