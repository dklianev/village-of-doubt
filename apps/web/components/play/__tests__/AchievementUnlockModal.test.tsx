import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AchievementUnlockModal } from "../AchievementUnlockModal";

describe("AchievementUnlockModal", () => {
  it("turns an unlock into a clear path toward the hall of legends", () => {
    const onClose = vi.fn();
    render(<AchievementUnlockModal achievementIds={["first_blood"]} onClose={onClose} />);

    expect(screen.getByRole("dialog", { name: "Отключени легенди" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Нова легенда в залата" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Виж залата на легендите" })).toHaveAttribute("href", "/achievements");

    fireEvent.click(screen.getByRole("button", { name: "Затвори" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
