import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Pill } from "./Pill";

describe("Pill", () => {
  it("renders as a button by default", () => {
    const { getByRole } = render(<Pill>Запази</Pill>);
    expect(getByRole("button", { name: "Запази" })).toBeDefined();
  });

  it("renders as a link when as=a", () => {
    const { getByRole } = render(
      <Pill as="a" href="/status">
        Виж състояние
      </Pill>,
    );
    expect(getByRole("link", { name: "Виж състояние" }).getAttribute("href")).toBe("/status");
  });

  it("marks intent via data attribute", () => {
    const { getByRole } = render(<Pill intent="danger">Изтрий</Pill>);
    expect(getByRole("button").dataset.dsPill).toBe("danger");
  });

  it("supports disabled buttons", () => {
    const { getByRole } = render(<Pill disabled>Запази</Pill>);
    expect(getByRole("button").hasAttribute("disabled")).toBe(true);
  });
});
