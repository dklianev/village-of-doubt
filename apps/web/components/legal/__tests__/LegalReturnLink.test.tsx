import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PrivacyDashboard } from "../../privacy/PrivacyDashboard";
import { TermsCodex } from "../../terms/TermsCodex";

describe("legal return links", () => {
  it.each(["privacy", "terms"] as const)("returns from %s sections to a focusable contents index", (page) => {
    render(page === "privacy"
      ? <PrivacyDashboard lastUpdated="29 септември 2026" userSnapshot={null} />
      : <TermsCodex lastUpdated="29 септември 2026" />);
    const index = screen.getByRole("navigation");
    expect(index).toHaveAttribute("id", `${page}-contents`);
    expect(index).toHaveAttribute("tabindex", "-1");
    const returns = screen.getAllByRole("link", { name: "Към съдържанието" });
    expect(returns.length).toBeGreaterThan(3);
    for (const link of returns) expect(link).toHaveAttribute("href", `#${page}-contents`);
  });
});
