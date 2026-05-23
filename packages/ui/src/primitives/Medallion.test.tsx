import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Medallion } from "./Medallion";

describe("Medallion", () => {
  it("renders a string label", () => {
    const { getByText } = render(<Medallion label="№" />);
    expect(getByText("№")).toBeDefined();
  });

  it("renders a numeric label", () => {
    const { getByText } = render(<Medallion label={8} />);
    expect(getByText("8")).toBeDefined();
  });

  it("marks the element with a data attribute", () => {
    const { getByText } = render(<Medallion label="1" />);
    expect(getByText("1").hasAttribute("data-ds-medallion")).toBe(true);
  });

  it("uses the requested size", () => {
    const { getByText } = render(<Medallion label="1" size={72} />);
    expect(getByText("1").style.width).toBe("72px");
  });
});
