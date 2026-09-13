import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { GameRolesPage } from "../game-roles-page";

describe("roles catalogue image loading", () => {
  it.each(["werewolves", "mafia"] as const)("sizes %s grid and detail artwork independently", async (family) => {
    const user = userEvent.setup();
    const { container } = render(<GameRolesPage family={family} />);
    const gridImage = container.querySelector<HTMLImageElement>(".role-codex-card img")!;

    expect(gridImage.sizes).toContain("(max-width: 760px)");
    expect(new URL(gridImage.src).searchParams.get("url")).not.toContain("/thumbs/");
    expect(gridImage.srcset).toMatch(/\d+w/);
    await user.click(container.querySelector<HTMLButtonElement>(".role-codex-card-button")!);
    const detailImage = (await screen.findByRole("dialog")).querySelector<HTMLImageElement>("img")!;
    expect(detailImage.sizes).not.toBe(gridImage.sizes);
    expect(detailImage.sizes).toContain("(max-width: 760px)");
    expect(detailImage.src).toBe(gridImage.src);
  });

  it("gives eager high priority only to the first currently visible role", async () => {
    const user = userEvent.setup();
    const { container } = render(<GameRolesPage family="werewolves" />);

    expectLoadingContract(container);

    await user.type(screen.getByRole("textbox", { name: "Търси роля" }), "лечител");
    await waitFor(() => expect(screen.getByText(/Търсене: “лечител”/)).toBeInTheDocument());

    expectLoadingContract(container);
  });

  it("falls back to the original WebP and removes failed optimizer candidates", () => {
    const { container } = render(<GameRolesPage family="werewolves" />);
    const firstImage = container.querySelector<HTMLImageElement>(".role-codex-card img");
    const initialSrc = firstImage?.getAttribute("src");
    const initialSrcSet = firstImage?.getAttribute("srcset");

    expect(initialSrc).toContain("/_next/image?");
    const original = new URL(firstImage!.src).searchParams.get("url");
    expect(initialSrcSet).toMatch(/\d+w/);
    fireEvent.error(firstImage!);

    expect(firstImage?.getAttribute("src")).toBe(original);
    expect(firstImage?.getAttribute("src")).not.toBe(initialSrc);
    expect(firstImage).not.toHaveAttribute("srcset");
    fireEvent.error(firstImage!);
    expect(firstImage?.getAttribute("src")).toBe(original);
  });

  it("uses the dedicated werewolf artwork for the jester card", () => {
    render(<GameRolesPage family="werewolves" />);

    const jesterCard = screen.getByRole("heading", { name: "Шут" }).closest("article");
    const image = jesterCard!.querySelector("img")!;
    expect(new URL(image.src).searchParams.get("url")).toBe("/game-art/role-jester-werewolf.webp?v=3");
  });
});

function expectLoadingContract(container: HTMLElement) {
  const images = [...container.querySelectorAll<HTMLImageElement>(".role-codex-card img")];
  expect(images.length).toBeGreaterThan(0);
  expect(images.filter((image) => image.getAttribute("loading") === "eager")).toHaveLength(1);
  expect(images.filter((image) => image.getAttribute("fetchpriority") === "high")).toHaveLength(1);
  expect(images[0]).toHaveAttribute("loading", "eager");
  expect(images[0]).toHaveAttribute("fetchpriority", "high");
  for (const image of images.slice(1)) {
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).not.toHaveAttribute("fetchpriority", "high");
  }
}
