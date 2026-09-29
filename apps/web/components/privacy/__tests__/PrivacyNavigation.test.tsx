import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PrivacyDashboard } from "../PrivacyDashboard";

describe("privacy navigation", () => {
  it("ships the public policy and literal title in server HTML", () => {
    const markup = renderToStaticMarkup(<PrivacyDashboard lastUpdated="17 май 2026" userSnapshot={null} />);
    render(<div dangerouslySetInnerHTML={{ __html: markup }} />);
    expect(screen.getByRole("heading", { level: 1, name: "Поверителност" })).toBeVisible();
    for (const id of ["what-and-why", "sharing", "retention", "cookies", "children"]) {
      expect(document.getElementById(id)?.querySelector(".privacy-section-body")).toBeVisible();
    }
    expect(screen.getByText(/„Сенките“ е онлайн социална игра/)).toBeVisible();
    expect(screen.queryByText(/Върколак и Мафия/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Нищо повече/)).not.toBeInTheDocument();
    expect(screen.getByText(/в рамките на 7 работни дни/)).toBeVisible();
    expect(document.getElementById("retention")).toHaveTextContent("до 24 месеца");
    expect(document.getElementById("retention")).toHaveTextContent("до 30 дни");
  });

  it("provides working anchors and practical rights before the promises and policy details", () => {
    render(<PrivacyDashboard lastUpdated="5 септември 2026" userSnapshot={null} />);
    const navigation = screen.getByRole("navigation", { name: "Съдържание на политиката" });
    for (const link of within(navigation).getAllByRole("link")) {
      expect(document.getElementById(link.getAttribute("href")!.slice(1))).toBeInTheDocument();
    }
    const rights = screen.getByRole("heading", { name: "Какво можеш да направиш." });
    const promises = screen.getByRole("heading", { name: "Какво гарантираме." });
    expect(rights.compareDocumentPosition(promises) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("link", { name: "Изтегли данни →" })).toHaveAttribute("href", "/account?section=data-export#account-data-export");
    expect(screen.getByRole("link", { name: "Промени данни →" })).toHaveAttribute("href", "/account#account-identity");
    expect(screen.getByRole("link", { name: "Към изтриване →" })).toHaveAttribute("href", "/account#account-security");
  });
});
