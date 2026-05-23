import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SceneCard } from "./SceneCard";

describe("SceneCard", () => {
  it("renders children", () => {
    const { getByText } = render(<SceneCard>Съдържание</SceneCard>);
    expect(getByText("Съдържание")).toBeDefined();
  });

  it("renders an optional eyebrow", () => {
    const { getByText } = render(<SceneCard eyebrow="СЪСТОЯНИЕ">Съдържание</SceneCard>);
    expect(getByText("СЪСТОЯНИЕ")).toBeDefined();
  });

  it("renders optional meta content", () => {
    const { getByText } = render(<SceneCard meta={<span>СЕГА</span>}>Съдържание</SceneCard>);
    expect(getByText("СЕГА")).toBeDefined();
  });

  it("marks density on the surface", () => {
    const { container } = render(<SceneCard density="lg">Съдържание</SceneCard>);
    expect((container.firstChild as HTMLElement).dataset.dsSceneCard).toBe("lg");
  });
});
