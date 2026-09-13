import { render as renderComponent, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { ImageConfigContext } from "next/dist/shared/lib/image-config-context.shared-runtime";
import { imageConfigDefault } from "next/dist/shared/lib/image-config";
import { describe, expect, it, vi } from "vitest";
import { RoleDetailModal } from "../RoleDetailModal";
import { RoleTileLarge } from "../RoleTileLarge";
import { ManualRoleBuilderClient } from "../../manual-role-builder-client";
import { StepRoles } from "../StepRoles";
import { initialState } from "@/lib/lobby-form";

function render(children: ReactNode) {
  return renderComponent(<ImageConfigContext.Provider value={{ ...imageConfigDefault, qualities: [75, 85] }}>
    {children}
  </ImageConfigContext.Provider>);
}

describe("lobby role artwork", () => {
  it.each(["werewolves", "mafia"] as const)("uses responsive full artwork for %s dossiers and gallery tiles", (family) => {
    const role = family === "mafia" ? "doctor" : "healer";
    const { container } = render(<>
      <RoleTileLarge family={family} role={role} count={1} onOpen={vi.fn()} />
      <RoleDetailModal family={family} role={role} onClose={vi.fn()} />
    </>);
    const detail = screen.getByRole("dialog").querySelector("img")!;
    const tile = container.querySelector<HTMLImageElement>(".role-tile-large img")!;
    for (const image of [detail, tile]) {
      expect(image.srcset).toMatch(/\d+w/);
      const original = new URL(image.src).searchParams.get("url");
      expect(new URL(original!, "https://assets.test").pathname).toMatch(/\/role-(doctor|healer)\.webp$/);
      expect(original).not.toContain("/thumbs/");
      expect(image.sizes).not.toBe("");
      expect(image.getAttribute("width")).toBe(family === "mafia" ? "1100" : "1024");
      expect(image.getAttribute("height")).toBe(family === "mafia" ? "1100" : "1536");
      expect(image.sizes).not.toContain("auto");
      if (family === "mafia") expect(image.sizes).toContain(" * ");
    }
    expect(detail.sizes).not.toBe(tile.sizes);
  });

  it("keeps manual-builder artwork responsive for both portrait and compact layouts", () => {
    const { container } = render(<ManualRoleBuilderClient
      family="werewolves"
      playerCount={8}
      roles={{ ordinary_villager: 5, werewolf: 2, seer: 1 }}
      warnings={[]}
      onRolesChange={vi.fn()}
      onSavePreset={vi.fn()}
      onLoadPreset={vi.fn()}
    />);
    const images = [...container.querySelectorAll<HTMLImageElement>(".manual-role-art img")];
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) {
      expect(new URL(image.src).searchParams.get("url")).not.toContain("/thumbs/");
      expect(image.srcset).toMatch(/\d+w/);
      expect(image.sizes).toContain("206px");
      expect(image.sizes).toContain("98px");
    }
    const square = container.querySelector<HTMLImageElement>(".role-insomniac img")!;
    expect(square.getAttribute("width")).toBe("1100");
    expect(square.getAttribute("height")).toBe("1100");
    expect(square.sizes).toContain(" * ");
  });

  it("opens the embedded role inspector with full responsive artwork", () => {
    const state = initialState({ family: "werewolves" });
    const { container } = render(<StepRoles
      state={{ ...state, roleDetail: { role: "seer", source: "tile" } }}
      dispatch={vi.fn()}
      embedded
    />);
    const image = container.querySelector<HTMLImageElement>(".create-inline-role-detail img")!;
    expect(new URL(image.src).searchParams.get("url")).toBe("/game-art/role-seer.webp?v=3");
    expect(image.closest("picture")).toHaveClass("role-art-frame");
    expect(image.closest("picture")).toHaveAttribute("data-frame-family", "werewolves");
    expect(image.closest("picture")).toHaveStyle({ aspectRatio: "0.6666666666666666" });
    expect(image.srcset).toMatch(/\d+w/);
    expect(image.sizes).not.toBe("");
  });

  it("accounts for square source artwork in the embedded inspector", () => {
    const state = initialState({ family: "werewolves" });
    const { container } = render(<StepRoles
      state={{ ...state, roleDetail: { role: "investigator", source: "tile" } }}
      dispatch={vi.fn()}
      embedded
    />);
    const image = container.querySelector<HTMLImageElement>(".create-inline-role-detail img")!;
    expect(image.getAttribute("width")).toBe("1100");
    expect(image.getAttribute("height")).toBe("1100");
    expect(image.closest("picture")).toHaveClass("role-art-frame");
    expect(image.closest("picture")).toHaveStyle({ aspectRatio: "1" });
    expect(image.sizes).not.toContain("auto");
    expect(image.sizes).toContain("calc(100vw - 60px)");
  });
});
