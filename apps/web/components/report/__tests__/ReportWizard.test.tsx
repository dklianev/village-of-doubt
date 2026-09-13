import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReportWizard } from "../ReportWizard";

describe("ReportWizard validation", () => {
  it.each(["click", "Enter"])("sends nothing before explicit review confirmation with %s", async (method) => {
    const user = userEvent.setup();
    const request = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(
      JSON.stringify({ referenceId: "СИГ-0123456789" }), { status: 200 },
    ));
    render(<ReportWizard userEmail={null} userName={null} visualStep={null} />);
    const activateNext = async () => {
      const next = screen.getByRole("button", { name: /Напред/ });
      if (method === "click") await user.click(next);
      else { next.focus(); await user.keyboard("{Enter}"); }
      expect(request).not.toHaveBeenCalled();
    };
    await activateNext();
    await user.type(screen.getByRole("textbox", { name: "Описание" }), "Достатъчно подробно описание на случилото се.");
    await activateNext();
    await activateNext();
    expect(screen.getByRole("status")).toHaveTextContent("Стъпка 4 от 4");
    const confirm = screen.getByRole("button", { name: "Изпрати сигнал" });
    if (method === "click") await user.click(confirm);
    else { confirm.focus(); await user.keyboard("{Enter}"); }
    expect(request).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("СИГ-0123456789")).toBeInTheDocument();
  });

  it("does not submit implicitly from an email input or an unconfirmed review form", async () => {
    const user = userEvent.setup();
    const request = vi.spyOn(globalThis, "fetch");
    const { container } = render(<ReportWizard userEmail="player@example.com" userName={null} visualStep={null} />);
    await user.click(screen.getByRole("button", { name: /Напред/ }));
    await user.type(screen.getByRole("textbox", { name: "Описание" }), "Достатъчно подробно описание на случилото се.");
    await user.click(screen.getByRole("button", { name: /Напред/ }));
    await user.click(screen.getByRole("textbox", { name: "Твоят имейл" }));
    await user.keyboard("{Enter}");
    expect(request).not.toHaveBeenCalled();
    if (screen.queryByRole("button", { name: /Напред/ })) {
      await user.click(screen.getByRole("button", { name: /Напред/ }));
    }
    fireEvent.submit(container.querySelector("form")!);
    expect(request).not.toHaveBeenCalled();
  });

  it("moves keyboard focus to each new step and announces progress, including Back", async () => {
    const user = userEvent.setup();
    render(<ReportWizard userEmail={null} userName={null} visualStep={null} />);
    screen.getByRole("button", { name: /Напред/ }).focus();
    await user.keyboard("{Enter}");
    expect(screen.getByText("Какво се случи?", { selector: "legend" })).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("Стъпка 2 от 4");
    await user.tab();
    expect(screen.getByRole("textbox", { name: "Описание" })).toHaveFocus();
    await user.type(screen.getByRole("textbox", { name: "Описание" }), "Достатъчно подробно описание на случилото се.");
    await user.click(screen.getByRole("button", { name: /Напред/ }));
    expect(screen.getByText("Как искаш да отговорим?", { selector: "legend" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: /Назад/ }));
    expect(screen.getByText("Какво се случи?", { selector: "legend" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: /Напред/ }));
    await user.click(screen.getByRole("button", { name: /Напред/ }));
    expect(screen.getByText("Преглед преди изпращане.", { selector: "legend" })).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("Стъпка 4 от 4");
  });

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
