import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PrivacyDashboard } from "../PrivacyDashboard";

describe("privacy navigation", () => {
  it("provides working anchors and practical rights before the promises and policy details", () => {
    render(<PrivacyDashboard lastUpdated="5 септември 2026" userSnapshot={null} />);
    const navigation = screen.getByRole("navigation", { name: "Съдържание на политиката" });
    for (const link of within(navigation).getAllByRole("link")) {
      expect(document.getElementById(link.getAttribute("href")!.slice(1))).toBeInTheDocument();
    }
    const rights = screen.getByRole("heading", { name: "Какво можеш да направиш." });
    const promises = screen.getByRole("heading", { name: "Какво гарантираме." });
    expect(rights.compareDocumentPosition(promises) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("link", { name: "Изтегли данни →" })).toHaveAttribute("href", "/account#account-data-export");
    expect(screen.getByRole("link", { name: "Промени данни →" })).toHaveAttribute("href", "/account#account-identity");
    expect(screen.getByRole("link", { name: "Към изтриване →" })).toHaveAttribute("href", "/account#account-security");
  });
});
