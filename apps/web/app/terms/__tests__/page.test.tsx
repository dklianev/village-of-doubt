import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import TermsPage, { metadata } from "../page";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));

describe("terms document", () => {
  it("renders a literal title and all formal clauses in server HTML without a session or hydration", () => {
    const markup = renderToStaticMarkup(<TermsPage />);
    render(<div dangerouslySetInnerHTML={{ __html: markup }} />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Условия за ползване" })).toBeVisible();
    expect(screen.getByText("Кодекс на масата")).toBeVisible();
    expect(JSON.stringify(metadata.title)).toContain("Условия за ползване");
    expect(getSession).not.toHaveBeenCalled();

    const navigation = screen.getByRole("navigation", { name: "Съдържание на условията" });
    expect(within(navigation).getAllByRole("link")).toHaveLength(8);
    for (const link of within(navigation).getAllByRole("link")) {
      const target = document.getElementById(link.getAttribute("href")!.slice(1))!;
      expect(target).toBeVisible();
      expect(target).toHaveAttribute("tabindex", "-1");
      expect(target.closest("details")).toBeNull();
    }
    for (const id of ["ip", "user-content", "as-is", "liability", "law", "contact"]) {
      const section = document.getElementById(id)!;
      expect(section.querySelector(".terms-annex-body")).toBeVisible();
    }
    const contact = within(document.getElementById("contact")!);
    expect(contact.getByRole("link", { name: "страницата за сигнал" })).toHaveAttribute("href", "/report");
    expect(contact.getByRole("link", { name: "политиката за поверителност" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByText("Като играеш, ти приемаш правилата по подразбиране.")).toBeVisible();
    expect(screen.getByText(/Минимум 13 години/)).toBeVisible();
    expect(screen.getByText(/Преглеждаме сигнала в рамките на 48 часа/)).toBeVisible();
    expect(screen.queryByText(/Не са правни клаузи/)).not.toBeInTheDocument();
  });

  it("includes every example in server HTML and expands it through native disclosures", async () => {
    const user = userEvent.setup();
    const markup = renderToStaticMarkup(<TermsPage />);
    const { container } = render(<div dangerouslySetInnerHTML={{ __html: markup }} />);
    const disclosures = container.querySelectorAll("details.terms-commitment-examples");
    expect(disclosures).toHaveLength(5);
    expect(disclosures[0]).toHaveAttribute("open");
    const ageExample = screen.getByText("Дете под 13 създава досие.");
    expect(ageExample).toBeInTheDocument();
    expect(ageExample).not.toBeVisible();
    await user.click(screen.getByText("Примери: Възраст"));
    expect(ageExample).toBeVisible();
    await user.click(screen.getByText("Примери: Възраст"));
    expect(ageExample).not.toBeVisible();
  });
});
