import { fireEvent, render as renderComponent, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { ImageConfigContext } from "next/dist/shared/lib/image-config-context.shared-runtime";
import { imageConfigDefault } from "next/dist/shared/lib/image-config";
import { describe, expect, it, vi } from "vitest";
import { RoleDetailModal } from "../../lobby/RoleDetailModal";
import { RoleTileLarge } from "../../lobby/RoleTileLarge";
import { RoleSpotlight } from "../RoleSpotlight";
import { VariantsChips } from "../VariantsChips";

function render(children: ReactNode) {
  return renderComponent(
    <ImageConfigContext.Provider value={{ ...imageConfigDefault, qualities: [75, 85] }}>
      {children}
    </ImageConfigContext.Provider>,
  );
}

describe.each(["werewolves", "mafia"] as const)("%s portrait frames", (family) => {
  const role = family === "mafia" ? "doctor" : "healer";

  it("frames spotlight portraits and keeps the expand affordance above the overlay", async () => {
    const { container } = render(<RoleSpotlight family={family} />);
    const portraits = container.querySelectorAll(".role-spotlight__art");
    expect(portraits).toHaveLength(4);
    for (const portrait of portraits) {
      expect(portrait).toHaveClass("role-art-frame");
      expect(portrait).toHaveAttribute("data-frame-family", family);
      expect(portrait.querySelector("img")).toHaveAttribute("data-nimg", "fill");
      expect(portrait.querySelector(".role-spotlight__open")).toHaveStyle({ zIndex: 2 });
    }

    fireEvent.click(portraits[0]!.querySelector(".role-spotlight__open")!);
    expect(portraits[0]!.closest("button")).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("frames only real variant portraits, leaving scene artwork and links intact", () => {
    const { container } = render(<VariantsChips family={family} />);
    const variants = container.querySelectorAll(".variant-chip");
    expect(variants).toHaveLength(3);
    for (const variant of variants) {
      const portrait = variant.querySelector(".variant-chip__art");
      const trigger = variant.querySelector("button[data-role]");
      expect(portrait?.querySelector("img")).toHaveAttribute("data-nimg", "fill");
      if (trigger) {
        expect(portrait).toHaveClass("role-art-frame");
        expect(portrait).toHaveAttribute("data-frame-family", family);
        expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
      } else {
        expect(portrait).not.toHaveClass("role-art-frame");
        expect(portrait).not.toHaveAttribute("data-frame-family");
        expect(variant.querySelector("a")).toHaveAttribute("href", family === "mafia" ? "/mafia/create" : "/werewolf/create");
      }
    }
    expect(container.querySelectorAll(".variant-chip__art.role-art-frame")).toHaveLength(2);
  });

  it("frames the tile picture without moving its count, caption, or controls into the overlay", () => {
    const tileRole = family === "mafia" ? "mafioso" : "werewolf";
    const onOpen = vi.fn();
    const onIncrement = vi.fn();
    const onDecrement = vi.fn();
    const { container } = render(
      <RoleTileLarge family={family} role={tileRole} count={1} compactOnMobile
        onOpen={onOpen} onIncrement={onIncrement} onDecrement={onDecrement} />,
    );
    const portrait = container.querySelector("picture")!;
    expect(portrait).toHaveClass("role-art-frame");
    expect(portrait).toHaveAttribute("data-frame-family", family);
    expect(portrait).toHaveAttribute("aria-hidden", "true");
    expect(portrait.querySelector(".role-tile-count, .role-tile-caption, button")).toBeNull();
    expect(container.querySelectorAll(".role-art-frame")).toHaveLength(1);
    expect(portrait.querySelector("img")!.sizes).toContain("64px");

    fireEvent.click(portrait);
    expect(onOpen).toHaveBeenCalledOnce();
    const controls = container.querySelectorAll(".role-tile-controls button");
    fireEvent.click(controls[0]!);
    fireEvent.click(controls[1]!);
    expect(onDecrement).toHaveBeenCalledOnce();
    expect(onIncrement).toHaveBeenCalledOnce();
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("frames only the detail picture and preserves the close action", () => {
    const onClose = vi.fn();
    render(<RoleDetailModal family={family} role={role} onClose={onClose} />);
    const dialog = screen.getByRole("dialog");
    const portrait = dialog.querySelector("picture")!;
    expect(portrait).toHaveClass("role-art-frame");
    expect(portrait).toHaveAttribute("data-frame-family", family);
    expect(portrait).toHaveAttribute("aria-hidden", "true");
    expect(dialog.querySelectorAll(".role-art-frame")).toHaveLength(1);
    const close = screen.getByRole("button");
    expect(close.closest(".role-art-frame")).toBeNull();
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
