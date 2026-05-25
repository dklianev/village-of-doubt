import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PaperCard } from "./PaperCard";

describe("PaperCard", () => {
  it("renders children", () => {
    const { getByText } = render(<PaperCard>Съдържание</PaperCard>);
    expect(getByText("Съдържание")).toBeDefined();
  });

  it("renders an optional eyebrow", () => {
    const { getByText } = render(<PaperCard eyebrow="ДОСИЕ">Съдържание</PaperCard>);
    expect(getByText("ДОСИЕ")).toBeDefined();
  });

  it("renders optional meta content", () => {
    const { getByText } = render(<PaperCard meta={<span>14.05</span>}>Съдържание</PaperCard>);
    expect(getByText("14.05")).toBeDefined();
  });

  it("marks density on the surface", () => {
    const { container } = render(<PaperCard density="lg">Съдържание</PaperCard>);
    expect((container.firstChild as HTMLElement).dataset.dsPaperCard).toBe("lg");
  });

  it("marks interactive cards without changing semantics", () => {
    const { container } = render(<PaperCard interactive>Съдържание</PaperCard>);
    const surface = container.firstChild as HTMLElement;
    expect(surface.dataset.interactive).toBe("true");
    expect(surface.tagName).toBe("DIV");
  });

  it("marks semantic accents on the surface", () => {
    const { container } = render(<PaperCard accent="win">Съдържание</PaperCard>);
    expect((container.firstChild as HTMLElement).dataset.accent).toBe("win");
  });

  it("omits interaction and accent attributes by default", () => {
    const { container } = render(<PaperCard>Съдържание</PaperCard>);
    const surface = container.firstChild as HTMLElement;
    expect(surface.dataset.interactive).toBeUndefined();
    expect(surface.dataset.accent).toBeUndefined();
  });
});
