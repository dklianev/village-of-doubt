import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RouteLoadingState } from "../RouteLoadingState";
import { LeaderboardSkeleton } from "@/components/skeleton";

describe("route loading states", () => {
  it("announces the leaderboard's inner Suspense fallback outside its busy region", () => {
    render(<LeaderboardSkeleton />);
    expect(screen.getByRole("status")).toHaveTextContent("Зареждаме класацията...");
    expect(screen.getByRole("status").closest('[aria-busy="true"]')).toBeNull();
    expect(screen.getByRole("article", { name: "Зареждане на класацията" })).toHaveAttribute("aria-busy", "true");
  });
  it.each(["account", "achievements", "play"] as const)("keeps %s pending without inventing data", (variant) => {
    const { container } = render(<RouteLoadingState title="Зареждане на страницата" variant={variant} />);
    expect(screen.getByRole("status")).toHaveTextContent("Зареждаме...");
    expect(screen.getByRole("main")).toHaveClass(`route-loading-${variant}`);
    expect(screen.getByRole("region", { name: "Зареждане на страницата" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status").closest('[aria-busy="true"]')).toBeNull();
    expect(container.querySelector(".route-loading-items")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelectorAll(".route-loading-item")).toHaveLength(variant === "achievements" ? 6 : 3);
    expect(container.querySelectorAll(".route-loading-table")).toHaveLength(variant === "play" ? 1 : 0);
    expect(container.querySelectorAll("img, button, progress, input")).toHaveLength(0);
    expect(screen.getByRole("link", { name: "Към началото" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Помощ" })).toHaveAttribute("href", "/faq");
  });
});
