import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Eyebrow } from "./Eyebrow";

describe("Eyebrow", () => {
  it("renders children", () => {
    const { getByText } = render(<Eyebrow>СЪСТОЯНИЕ</Eyebrow>);
    expect(getByText("СЪСТОЯНИЕ")).toBeDefined();
  });

  it("defaults to default tone", () => {
    const { getByText } = render(<Eyebrow>Label</Eyebrow>);
    expect(getByText("Label").dataset.dsEyebrow).toBe("default");
  });

  it("applies the requested tone", () => {
    const { getByText } = render(<Eyebrow tone="blood">СИГНАЛ</Eyebrow>);
    expect(getByText("СИГНАЛ").dataset.dsEyebrow).toBe("blood");
  });
});
