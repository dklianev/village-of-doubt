import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NavDropdown } from "../NavDropdown";

describe("NavDropdown", () => {
  it("uses native navigation semantics and the browser tab order", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Преди връзките</button>
        <NavDropdown onNavigate={vi.fn()} />
      </>,
    );

    const navigation = screen.getByRole("navigation", { name: "Още страници" });
    const links = screen.getAllByRole("link");
    expect(navigation).toContainElement(links[0]!);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();

    screen.getByRole("button", { name: "Преди връзките" }).focus();
    await user.tab();
    expect(links[0]).toHaveFocus();
  });
});
