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

  it("marks interactive cards without changing semantics", () => {
    const { container } = render(<SceneCard interactive>Съдържание</SceneCard>);
    const surface = container.firstChild as HTMLElement;
    expect(surface.dataset.interactive).toBe("true");
    expect(surface.tagName).toBe("DIV");
  });

  it("marks semantic accents on the surface", () => {
    const { container } = render(<SceneCard accent="loss">Съдържание</SceneCard>);
    expect((container.firstChild as HTMLElement).dataset.accent).toBe("loss");
  });

  it("omits interaction and accent attributes by default", () => {
    const { container } = render(<SceneCard>Съдържание</SceneCard>);
    const surface = container.firstChild as HTMLElement;
    expect(surface.dataset.interactive).toBeUndefined();
    expect(surface.dataset.accent).toBeUndefined();
  });

  it("renders a background layer when background.image is provided", () => {
    const { container } = render(
      <SceneCard background={{ image: "linear-gradient(red, blue)" }}>Съдържание</SceneCard>,
    );
    const layer = container.querySelector("[data-ds-scene-card-background]") as HTMLElement | null;
    expect(layer).toBeTruthy();
    expect(layer?.getAttribute("style")).toContain("linear-gradient(red, blue)");
  });

  it("omits the background layer when background is not provided", () => {
    const { container } = render(<SceneCard>Съдържание</SceneCard>);
    expect(container.querySelector("[data-ds-scene-card-background]")).toBeNull();
  });

  it("applies requested overlay and focal point values", () => {
    const { container } = render(
      <SceneCard background={{ image: "linear-gradient(red, blue)", overlay: "veil", focalX: 25, focalY: 70 }}>
        Съдържание
      </SceneCard>,
    );
    const layer = container.querySelector("[data-ds-scene-card-background]") as HTMLElement;
    const style = layer.getAttribute("style") ?? "";
    expect(style).toContain("0.78");
    expect(style).toContain("25% 70%");
  });

  it("applies minHeight to the surface when background.minHeight is provided", () => {
    const { container } = render(
      <SceneCard background={{ image: "linear-gradient(red, blue)", minHeight: "400px" }}>Съдържание</SceneCard>,
    );
    const surface = container.firstChild as HTMLElement;
    expect(surface.style.minHeight).toBe("400px");
    expect(surface.style.display).toBe("grid");
  });

  it("does not set minHeight when background.minHeight is omitted", () => {
    const { container } = render(
      <SceneCard background={{ image: "linear-gradient(red, blue)" }}>Съдържание</SceneCard>,
    );
    const surface = container.firstChild as HTMLElement;
    expect(surface.style.minHeight).toBe("");
    expect(surface.style.display).toBe("");
  });
});
