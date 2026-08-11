import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ImgHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";
import { GameRolesPage } from "../game-roles-page";

vi.mock("next/image", () => ({
  default: ({ src, loading, fetchPriority, priority: _priority, ...props }: ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => {
    const resolvedSrc = typeof src === "string" ? src : "";
    return (
      <img
        {...props}
        src={resolvedSrc}
        srcSet={`${resolvedSrc} 1x`}
        data-loading={loading}
        data-fetch-priority={fetchPriority}
      />
    );
  },
}));

describe("roles catalogue image loading", () => {
  it("gives eager high priority only to the first currently visible role", async () => {
    const user = userEvent.setup();
    const { container } = render(<GameRolesPage family="werewolves" />);

    expectLoadingContract(container);

    await user.type(screen.getByRole("textbox", { name: "Търси роля" }), "лечител");
    await waitFor(() => expect(screen.getByText(/Търсене: “лечител”/)).toBeInTheDocument());

    expectLoadingContract(container);
  });

  it("switches both src and srcset through React state when optimized artwork fails", () => {
    const { container } = render(<GameRolesPage family="werewolves" />);
    const firstImage = container.querySelector<HTMLImageElement>(".role-codex-card img");
    const initialSrc = firstImage?.getAttribute("src");
    const initialSrcSet = firstImage?.getAttribute("srcset");

    expect(initialSrc).toMatch(/\.webp$/);
    fireEvent.error(firstImage!);

    expect(firstImage?.getAttribute("src")).toMatch(/\.webp$/);
    expect(firstImage?.getAttribute("src")).not.toBe(initialSrc);
    expect(firstImage?.getAttribute("srcset")).not.toBe(initialSrcSet);
  });

  it("uses the dedicated werewolf artwork for the jester card", () => {
    render(<GameRolesPage family="werewolves" />);

    const jesterCard = screen.getByRole("heading", { name: "Шут" }).closest("article");
    expect(jesterCard?.querySelector("img")).toHaveAttribute(
      "src",
      "/game-art/thumbs/role-jester-werewolf.webp",
    );
  });
});

function expectLoadingContract(container: HTMLElement) {
  const images = [...container.querySelectorAll<HTMLImageElement>(".role-codex-card img")];
  expect(images.length).toBeGreaterThan(0);
  expect(images.filter((image) => image.dataset.loading === "eager")).toHaveLength(1);
  expect(images.filter((image) => image.dataset.fetchPriority === "high")).toHaveLength(1);
  expect(images[0]).toHaveAttribute("data-loading", "eager");
  expect(images[0]).toHaveAttribute("data-fetch-priority", "high");
  for (const image of images.slice(1)) {
    expect(image).toHaveAttribute("data-loading", "lazy");
    expect(image).not.toHaveAttribute("data-fetch-priority", "high");
  }
}
