import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ReportWizard } from "../ReportWizard";

describe("ReportWizard validation", () => {
  it("describes and focuses the first invalid field on each validated step", async () => {
    const user = userEvent.setup();
    render(<ReportWizard userEmail={null} userName={null} visualStep={null} />);

    await user.click(screen.getByRole("button", { name: /Напред/ }));
    const body = screen.getByRole("textbox", { name: "Описание" });
    await user.click(screen.getByRole("button", { name: /Напред/ }));

    expect(body).toHaveFocus();
    expect(body).toHaveAttribute("aria-invalid", "true");
    const bodyErrorId = body.getAttribute("aria-describedby");
    expect(bodyErrorId).toBeTruthy();
    expect(document.getElementById(bodyErrorId ?? "")).toHaveTextContent("Опиши с поне 20 символа.");

    await user.type(body, "Достатъчно подробно описание на случилото се.");
    await user.click(screen.getByRole("button", { name: /Напред/ }));
    await user.click(screen.getByRole("radio", { name: /С имейл/ }));
    const email = screen.getByRole("textbox", { name: "Твоят имейл" });
    await user.click(screen.getByRole("button", { name: /Напред/ }));

    expect(email).toHaveFocus();
    expect(email).toHaveAttribute("aria-invalid", "true");
    const emailErrorId = email.getAttribute("aria-describedby");
    expect(emailErrorId).toBeTruthy();
    expect(document.getElementById(emailErrorId ?? "")).toHaveTextContent(
      "Въведи имейл или избери анонимен сигнал.",
    );
  });
});
