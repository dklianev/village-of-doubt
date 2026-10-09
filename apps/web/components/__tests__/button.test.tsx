import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/button";
import { ButtonLink } from "@/components/button-link";

vi.mock("next/link", () => ({
  default: ({ href, ...props }: { href: string } & Record<string, unknown>) => <a href={href} {...props} />,
}));

describe("Button", () => {
  it("renders the shared .btn system and never submits a form by default", () => {
    render(<form><Button>Готов</Button><Button variant="secondary" type="submit">Изпрати</Button></form>);
    expect(screen.getByRole("button", { name: "Готов" })).toHaveAttribute("type", "button");
    expect(screen.getByRole("button", { name: "Готов" })).toHaveClass("btn", "btn-primary");
    expect(screen.getByRole("button", { name: "Изпрати" })).toHaveAttribute("type", "submit");
    expect(screen.getByRole("button", { name: "Изпрати" })).toHaveClass("btn", "btn-secondary");
  });

  it("keeps local classes and forwards refs", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref} className="play-confirm-skip">Пропусни</Button>);
    expect(ref.current).toBe(screen.getByRole("button", { name: "Пропусни" }));
    expect(ref.current).toHaveClass("btn", "btn-primary", "play-confirm-skip");
  });

  it("links look like buttons without becoming buttons", () => {
    render(<ButtonLink variant="secondary" href="/history">Към архива</ButtonLink>);
    const link = screen.getByRole("link", { name: "Към архива" });
    expect(link).toHaveAttribute("href", "/history");
    expect(link).toHaveClass("btn", "btn-secondary");
  });
});
