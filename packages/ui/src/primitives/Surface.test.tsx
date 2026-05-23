import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Surface } from "./Surface";

describe("Surface", () => {
  it("renders children", () => {
    const { getByText } = render(<Surface>Hello</Surface>);
    expect(getByText("Hello")).toBeDefined();
  });

  it("applies variant via data attribute", () => {
    const { container } = render(<Surface variant="scene">child</Surface>);
    expect((container.firstChild as HTMLElement).dataset.dsSurface).toBe("scene");
  });

  it("renders as a different HTML element when as is set", () => {
    const { container } = render(<Surface as="article">child</Surface>);
    expect(container.firstChild?.nodeName).toBe("ARTICLE");
  });

  it("forwards arbitrary HTML props", () => {
    const { getByRole } = render(
      <Surface as="article" role="region" aria-label="X">
        child
      </Surface>,
    );
    expect(getByRole("region")).toBeDefined();
  });
});
