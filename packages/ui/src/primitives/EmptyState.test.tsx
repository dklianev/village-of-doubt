import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders title and body", () => {
    const { getByText } = render(<EmptyState title="Няма известия." body="Писмата ще се появят тук." />);
    expect(getByText("Няма известия.")).toBeDefined();
    expect(getByText("Писмата ще се появят тук.")).toBeDefined();
  });

  it("renders an optional artifact", () => {
    const { getByLabelText } = render(
      <EmptyState title="Няма известия." body="Писмата ще се появят тук." artifact={<span aria-label="Писмо" />} />,
    );
    expect(getByLabelText("Писмо")).toBeDefined();
  });

  it("renders an optional action", () => {
    const { getByRole } = render(
      <EmptyState title="Няма известия." body="Писмата ще се появят тук." action={<button>Продължи</button>} />,
    );
    expect(getByRole("button", { name: "Продължи" })).toBeDefined();
  });

  it("marks the inner state container", () => {
    const { getByText } = render(<EmptyState title="Няма известия." body="Писмата ще се появят тук." />);
    expect(getByText("Няма известия.").parentElement?.hasAttribute("data-ds-empty-state")).toBe(true);
  });
});
