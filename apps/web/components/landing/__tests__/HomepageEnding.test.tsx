import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FinalLandingCta, LandingExperience } from "@/components/landing-experience";

vi.mock("@/components/landing/ModeChoiceCards", () => ({ ModeChoiceCards: () => null }));

describe("homepage ending", () => {
  it("renders the beta homepage without unavailable activity or invented statistics", () => {
    render(<LandingExperience initialSession={null} />);
    expect(screen.getByRole("heading", { level: 1, name: "Върколак или Мафия" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Готов ли си да седнеш на масата" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "Игрите тази вечер" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Данните за игрите|В момента няма активни стаи|Още няма завършени игри/)).not.toBeInTheDocument();
  });

  it("keeps both direct creation paths and a lazy decorative invitation in the closing section", () => {
    const { container } = render(<FinalLandingCta />);
    const section = screen.getByRole("region", { name: "Готов ли си да седнеш на масата" });
    expect(within(section).getByRole("heading", { name: "Кого ще поканиш?", level: 2 })).toBeVisible();
    expect(within(section).getByRole("link", { name: "Играй Върколак" })).toHaveAttribute("href", "/werewolf/create");
    expect(within(section).getByRole("link", { name: "Играй Мафия" })).toHaveAttribute("href", "/mafia/create");
    const images = container.querySelectorAll(".landing-final-art img");
    expect(images).toHaveLength(2);
    for (const image of images) {
      expect(image).toHaveAttribute("alt", "");
      expect(image).toHaveAttribute("loading", "lazy");
      expect(image.closest('[aria-hidden="true"]')).not.toBeNull();
    }
    for (const theme of ["light", "dark"] as const) {
      const picture = container.querySelector(`.landing-final-art--${theme}`);
      const filename = `invitation-${theme === "light" ? "light-" : ""}v1.webp`;
      expect(picture?.querySelector("img")).toHaveAttribute("src", `/game-art/homepage/${filename}`);
      expect(picture?.querySelector('source[media="(max-width: 767px)"]')).toHaveAttribute(
        "srcset", `/game-art/mobile/homepage/${filename}`,
      );
    }
    expect(within(section).queryByRole("img")).not.toBeInTheDocument();
  });
});
