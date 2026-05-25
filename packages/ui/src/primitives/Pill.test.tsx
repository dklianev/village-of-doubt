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

  it("emits shimmer and tracked state attributes", () => {
    const { getByRole } = render(
      <Pill shimmer tracked>
        Избери игра
      </Pill>,
    );
    const pill = getByRole("button");
    expect(pill.dataset.shimmer).toBe("true");
    expect(pill.dataset.tracked).toBe("true");
  });

  it("preserves text content semantics when tracked uppercase is active", () => {
    const { getByRole } = render(<Pill tracked>Избери игра</Pill>);
    expect(getByRole("button").textContent).toBe("Избери игра");
  });

  it("does not add aria-hidden or break button semantics with shimmer", () => {
    const { getByRole } = render(<Pill shimmer>Действие</Pill>);
    const pill = getByRole("button", { name: "Действие" });
    expect(pill.getAttribute("aria-hidden")).toBeNull();
    expect(pill.tagName).toBe("BUTTON");
  });

  it("forwards aria-pressed for toggle usage", () => {
    const { getByRole } = render(<Pill aria-pressed={true}>Филтър</Pill>);
    expect(getByRole("button").getAttribute("aria-pressed")).toBe("true");
  });

  it("supports faction intent in data-faction contexts", () => {
    const { getByRole } = render(
      <div data-faction="werewolves">
        <Pill intent="faction">Влез</Pill>
      </div>,
    );
    expect(getByRole("button").dataset.intent).toBe("faction");
  });

  it("supports disabled buttons", () => {
    const { getByRole } = render(<Pill disabled>Запази</Pill>);
    expect(getByRole("button").hasAttribute("disabled")).toBe(true);
  });
});
