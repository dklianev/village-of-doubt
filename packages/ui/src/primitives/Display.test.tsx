import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Display } from "./Display";

describe("Display", () => {
  it("renders children", () => {
    const { getByText } = render(<Display>Селото оцеля</Display>);
    expect(getByText("Селото оцеля")).toBeDefined();
  });

  it("maps h2 size to h2 by default", () => {
    const { container } = render(<Display size="h2">Заглавие</Display>);
    expect(container.firstChild?.nodeName).toBe("H2");
  });

  it("allows semantic element override", () => {
    const { container } = render(
      <Display size="h3" as="p">
        Текст
      </Display>,
    );
    expect(container.firstChild?.nodeName).toBe("P");
  });

  it("marks the visual size via data attribute", () => {
    const { getByText } = render(<Display size="h4">Малко</Display>);
    expect(getByText("Малко").dataset.dsDisplay).toBe("h4");
  });
});
