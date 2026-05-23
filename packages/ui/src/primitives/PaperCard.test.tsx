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
});
