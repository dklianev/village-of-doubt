import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StatusHero } from "../StatusHero";
import { StatusLastIncident } from "../StatusLastIncident";
import { StatusLegend } from "../StatusLegend";
import { StatusSubscribe } from "../StatusSubscribe";

describe("status content", () => {
  it("does not present a missing incident source as an incident-free history", () => {
    render(<StatusLastIncident />);
    expect(screen.getByText(/Няма свързан източник/)).toHaveTextContent("Това не означава, че не е имало прекъсвания.");
    expect(screen.getByRole("link", { name: "Подай сигнал за проблем" })).toHaveAttribute("href", "/report");
    expect(screen.queryByText(/Няма скорошни инциденти/)).not.toBeInTheDocument();
  });

  it("does not claim recovery work is in progress without a source", () => {
    const { container } = render(<><StatusHero overall="down" lastCheckedAt="2026-09-20T10:00:00.000Z" refreshing={false} onRefresh={vi.fn()} /><StatusLegend /></>);
    expect(screen.getByRole("status")).toHaveTextContent("Проверката установи недостъпна услуга.");
    expect(container).not.toHaveTextContent(/Работим|по възстановяване|по решение/);
  });

  it.each([null, "", "soon", "javascript:alert(1)", "http://community.test", "https://synthetic:secret@community.test"])("omits unavailable or invalid community links: %s", (url) => {
    const { container } = render(<StatusSubscribe discordUrl={url} telegramUrl={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each(["discord", "telegram"])("renders only the available %s community without promising subscriptions", (channel) => {
    const url = "https://community.test/senkite";
    const { container } = render(<StatusSubscribe discordUrl={channel === "discord" ? url : null} telegramUrl={channel === "telegram" ? url : null} />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link")).toHaveAttribute("href", url);
    expect(screen.getByRole("link")).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("heading")).toHaveTextContent("Общност");
    expect(container).not.toHaveTextContent(/Скоро|уведомления|инциденти/);
    expect(container.querySelector("[aria-disabled]")).not.toBeInTheDocument();
  });
});
