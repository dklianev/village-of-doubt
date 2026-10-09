import { createHash, randomUUID } from "node:crypto";
import { Activity } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReportWizard } from "../ReportWizard";

beforeEach(() => {
  vi.stubGlobal("crypto", {
    randomUUID,
    subtle: { digest: async (_algorithm: string, data: Uint8Array) => Uint8Array.from(createHash("sha256").update(data).digest()).buffer },
  });
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Unconfigured report fixture"));
});

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); });

const description = "Достатъчно подробно описание на случилото се.";
const successResponse = () => new Response(JSON.stringify({ referenceId: "СИГ-0123456789" }), { status: 200 });

async function enterDetails(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /Напред/ }));
  await user.type(screen.getByRole("textbox", { name: "Описание" }), description);
  await user.type(screen.getByRole("textbox", { name: /Код на стая/ }), "ABC123, 21:30");
  await user.click(screen.getByRole("button", { name: /Напред/ }));
}

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
    expect(screen.getByRole("status")).toHaveTextContent("Стъпка 2 от 4: Подробности");
    const steps = within(screen.getByRole("navigation", { name: "Стъпки" })).getAllByRole("listitem");
    expect(steps).toHaveLength(4);
    expect(steps.map((item) => item.querySelector(".report-step-name")?.textContent)).toEqual([
      "Вид сигнал", "Подробности", "Връзка", "Преглед",
    ]);
    expect(steps[0]).toHaveAttribute("data-complete", "true");
    expect(steps[1]).toHaveAttribute("aria-current", "step");
    expect(steps[2]).not.toHaveAttribute("aria-current");
    await user.tab();
    expect(screen.getByRole("textbox", { name: "Описание" })).toHaveFocus();
    await user.type(screen.getByRole("textbox", { name: "Описание" }), "Достатъчно подробно описание на случилото се.");
    await user.click(screen.getByRole("button", { name: /Напред/ }));
    expect(screen.getByText("Как искаш да отговорим?", { selector: "legend" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: /Назад/ }));
    expect(screen.getByText("Какво се случи?", { selector: "legend" })).toHaveFocus();
    expect(screen.getByRole("textbox", { name: "Описание" })).toHaveValue(description);
    expect(steps[2]).toHaveAttribute("data-complete", "false");
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
    expect(body.closest(".report-field")).toContainElement(document.getElementById(bodyErrorId!));

    await user.type(body, "Достатъчно подробно описание на случилото се.");
    await user.click(screen.getByRole("button", { name: /Напред/ }));
    await user.click(screen.getByRole("radio", { name: /С имейл/ }));
    const email = screen.getByRole("textbox", { name: "Твоят имейл" });
    await user.click(screen.getByRole("button", { name: /Напред/ }));

    expect(email).toHaveFocus();
    expect(email).toHaveAttribute("aria-invalid", "true");
    const emailErrorId = email.getAttribute("aria-describedby");
    expect(emailErrorId).toBeTruthy();
    expect(email.closest(".report-field")).toContainElement(document.getElementById(emailErrorId!));
    expect(document.getElementById(emailErrorId ?? "")).toHaveTextContent(
      "Въведи имейл или избери анонимен сигнал.",
    );
  });

  it("marks selected native radios with a check, also when selected with arrow keys", async () => {
    const user = userEvent.setup();
    render(<ReportWizard userEmail={null} userName={null} visualStep={null} />);
    const abuse = screen.getByRole("radio", { name: /Тормоз/ });
    const copyright = screen.getByRole("radio", { name: /Авторски права/ });
    expect(abuse).toBeChecked();
    expect(abuse.closest("label")?.querySelector("svg.lucide-circle-check")).toBeInTheDocument();
    expect(copyright.closest("label")?.querySelector("svg.lucide-circle-check")).not.toBeInTheDocument();
    abuse.focus();
    await user.keyboard("{ArrowRight}");
    expect(copyright).toBeChecked();
    expect(copyright).toHaveFocus();
    expect(copyright.closest("label")?.querySelector("svg.lucide-circle-check")).toBeInTheDocument();
    expect(abuse.closest("label")?.querySelector("svg.lucide-circle-check")).not.toBeInTheDocument();

    await user.click(abuse);
    await enterDetails(user);
    const anonymous = screen.getByRole("radio", { name: /Анонимно/ });
    const identified = screen.getByRole("radio", { name: /С имейл/ });
    expect(anonymous).toBeChecked();
    expect(anonymous.closest("label")?.querySelector("svg.lucide-circle-check")).toBeInTheDocument();
    await user.click(identified);
    expect(identified).toBeChecked();
    expect(identified.closest("label")?.querySelector("svg.lucide-circle-check")).toBeInTheDocument();
    expect(anonymous.closest("label")?.querySelector("svg.lucide-circle-check")).not.toBeInTheDocument();
  });

  it("sends full Bulgarian field limits only after explicit confirmation", async () => {
    const user = userEvent.setup();
    const request = vi.mocked(fetch).mockResolvedValueOnce(successResponse());
    render(<ReportWizard userEmail={null} userName={null} visualStep={null} />);
    await user.click(screen.getByRole("button", { name: /Напред/ }));
    const body = screen.getByRole("textbox", { name: "Описание" });
    const evidence = screen.getByRole("textbox", { name: /Код на стая/ });
    expect(body).toHaveAttribute("maxlength", "4000");
    expect(evidence).toHaveAttribute("maxlength", "500");
    fireEvent.change(body, { target: { value: "я".repeat(4000) } });
    fireEvent.change(evidence, { target: { value: "я".repeat(500) } });
    await user.click(screen.getByRole("button", { name: /Напред/ }));
    await user.click(screen.getByRole("button", { name: /Напред/ }));
    expect(request).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Изпрати сигнал" }));
    expect(request).toHaveBeenCalledTimes(1);
    expect(JSON.parse(request.mock.calls[0]![1]!.body as string)).toEqual({
      type: "abuse", body: "я".repeat(4000), evidence: "я".repeat(500), email: null,
    });
  });

  it.each([
    ["Описание", "я".repeat(4001), "Описанието може да е до 4000 символа."],
    ["Код на стая и приблизителен час (по избор)", "я".repeat(501), "Допълнителната информация може да е до 500 символа."],
  ])("rejects oversize %s even when the DOM maxlength is bypassed", async (label, value, message) => {
    const user = userEvent.setup();
    render(<ReportWizard userEmail={null} userName={null} visualStep={null} />);
    await user.click(screen.getByRole("button", { name: /Напред/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Описание" }), { target: { value: description } });
    const field = screen.getByRole("textbox", { name: label });
    fireEvent.change(field, { target: { value } });
    await user.click(screen.getByRole("button", { name: /Напред/ }));
    expect(field).toHaveFocus();
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription(message);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("clears stale validation on Back without clearing the draft", async () => {
    const user = userEvent.setup();
    render(<ReportWizard userEmail={null} userName={null} visualStep={null} />);
    await enterDetails(user);
    await user.click(screen.getByRole("radio", { name: /С имейл/ }));
    await user.type(screen.getByRole("textbox", { name: "Твоят имейл" }), "невалиден");
    await user.click(screen.getByRole("button", { name: /Напред/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("Въведи валиден имейл.");
    await user.click(screen.getByRole("button", { name: /Назад/ }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Какво се случи?", { selector: "legend" })).toHaveFocus();
    expect(screen.getByRole("textbox", { name: "Описание" })).toHaveValue(description);
    expect(screen.getByRole("textbox", { name: /Код на стая/ })).toHaveValue("ABC123, 21:30");
    await user.click(screen.getByRole("button", { name: /Напред/ }));
    expect(screen.getByRole("textbox", { name: "Твоят имейл" })).toHaveValue("невалиден");
    await user.click(screen.getByRole("button", { name: /Напред/ }));
    await user.click(screen.getByRole("radio", { name: /Анонимно/ }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Напред/ }));
    expect(screen.getByRole("button", { name: "Изпрати сигнал" })).toBeEnabled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("validates the email limit even when a prefilled address exceeds it", async () => {
    const user = userEvent.setup();
    render(<ReportWizard userEmail={`${"a".repeat(243)}@example.com`} userName={null} visualStep={null} />);
    await enterDetails(user);
    const email = screen.getByRole("textbox", { name: "Твоят имейл" });
    expect(email).toHaveAttribute("maxlength", "254");
    await user.click(screen.getByRole("button", { name: /Напред/ }));
    expect(email).toHaveFocus();
    expect(email).toHaveAccessibleDescription("Имейлът може да е до 254 символа.");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("omits the signed-in identity when the player chooses an anonymous report", async () => {
    const user = userEvent.setup();
    const request = vi.mocked(fetch).mockResolvedValueOnce(successResponse());
    render(<ReportWizard userEmail="player@example.com" userName="Примерно име" visualStep={null} />);
    await enterDetails(user);
    await user.click(screen.getByRole("radio", { name: /Анонимно/ }));
    await user.click(screen.getByRole("button", { name: /Напред/ }));
    expect(screen.queryByText(/player@example.com|Примерно име/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Изпрати сигнал" }));
    const payload = request.mock.calls[0]![1]!.body as string;
    expect(JSON.parse(payload)).toEqual({ type: "abuse", body: description, evidence: "ABC123, 21:30", email: null });
    expect(payload).not.toContain("player@example.com");
    expect(payload).not.toContain("Примерно име");
    expect(screen.getByRole("heading", { name: "Сигналът е изпратен." })).toHaveFocus();
    expect(screen.getByText("Сигналът е анонимен. Не е посочен имейл за връзка.")).toBeInTheDocument();
  });

  it("locks Back and repeated submission while pending, then focuses success", async () => {
    const user = userEvent.setup();
    let resolve!: (response: Response) => void;
    const request = vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>((done) => { resolve = done; }));
    const { container } = render(<ReportWizard userEmail={null} userName={null} visualStep="review" />);
    const submit = screen.getByRole("button", { name: "Изпрати сигнал" });
    await user.dblClick(submit);
    expect(request).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Изпращаме..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Назад/ })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Изпращаме сигнала...");
    expect(container.querySelector("form")).toHaveAttribute("aria-busy", "true");
    fireEvent(container.querySelector("form")!, new SubmitEvent("submit", { bubbles: true, cancelable: true, submitter: submit }));
    expect(request).toHaveBeenCalledTimes(1);
    await act(async () => { resolve(successResponse()); });
    expect(screen.getByRole("heading", { name: "Сигналът е изпратен." })).toHaveFocus();
    expect(screen.getByText("СИГ-0123456789")).toBeInTheDocument();
  });

  it.each(["server", "network"])("keeps the review draft after a %s failure and retries only on confirmation", async (failure) => {
    const user = userEvent.setup();
    const request = vi.mocked(fetch);
    if (failure === "server") request.mockResolvedValueOnce(new Response(JSON.stringify({ error: "Временно недостъпно." }), { status: 503 }));
    else request.mockRejectedValueOnce(new TypeError("Network fixture"));
    request.mockResolvedValueOnce(successResponse());
    const { container } = render(<ReportWizard userEmail="player@example.com" userName={null} visualStep="review" />);
    await user.click(screen.getByRole("button", { name: "Изпрати сигнал" }));
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent(failure === "server"
      ? "Временно недостъпно."
      : "Не успяхме да потвърдим изпращането. Провери връзката си и опитай отново.");
    expect(screen.getByRole("button", { name: /Назад/ })).toBeEnabled();
    expect(container.querySelector("form")).toHaveAttribute("aria-busy", "false");
    expect(screen.getByText("С имейл (player@example.com)")).toBeInTheDocument();
    fireEvent.submit(container.querySelector("form")!);
    expect(request).toHaveBeenCalledTimes(1);
    const retry = screen.getByRole("button", { name: "Опитай отново" });
    retry.focus();
    await user.keyboard("{Enter}");
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1]![1]!.body).toBe(request.mock.calls[0]![1]!.body);
    expect(request.mock.calls[1]![1]!.headers).toEqual(request.mock.calls[0]![1]!.headers);
    expect(screen.getByRole("heading", { name: "Сигналът е изпратен." })).toHaveFocus();
  });

  it("clears delivery errors when going Back and requires a fresh review confirmation", async () => {
    const user = userEvent.setup();
    const request = vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: "Изчакай малко." }), { status: 429 }));
    render(<ReportWizard userEmail="player@example.com" userName={null} visualStep="review" />);
    await user.click(screen.getByRole("button", { name: "Изпрати сигнал" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Изчакай малко.");
    await user.click(screen.getByRole("button", { name: /Назад/ }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Как искаш да отговорим?", { selector: "legend" })).toHaveFocus();
    expect(screen.getByRole("textbox", { name: "Твоят имейл" })).toHaveValue("player@example.com");
    await user.click(screen.getByRole("button", { name: /Напред/ }));
    expect(screen.getByRole("button", { name: "Изпрати сигнал" })).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it.each(["not json", "null", '{"error":{}}', '{"error":""}'])("handles an invalid error response without losing the form: %s", async (body) => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(body, { status: 500 }));
    render(<ReportWizard userEmail={null} userName={null} visualStep="review" />);
    await user.click(screen.getByRole("button", { name: "Изпрати сигнал" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Сигналът не успя да се изпрати. Опитай отново.");
    expect(screen.getByRole("button", { name: "Опитай отново" })).toBeEnabled();
  });

  it.each(["not json", "null", "{}", '{"referenceId":"fake"}'])("never invents a receipt for malformed success: %s", async (body) => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(body, { status: 200 }));
    render(<ReportWizard userEmail={null} userName={null} visualStep="review" />);
    await user.click(screen.getByRole("button", { name: "Изпрати сигнал" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Не успяхме да потвърдим изпращането.");
    expect(screen.queryByRole("heading", { name: "Сигналът е изпратен." })).not.toBeInTheDocument();
    expect(screen.queryByText(/^СИГ-/)).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("ReportWizard request lifetime", () => {
  it.each(["request", "body"])("recovers a pending %s after Activity hides and restores the draft", async (phase) => {
    const user = userEvent.setup();
    const never = new Promise<Response>(() => {});
    const request = vi.mocked(fetch);
    if (phase === "request") request.mockReturnValueOnce(never);
    else request.mockResolvedValueOnce({ ok: true, json: () => never } as unknown as Response);
    request.mockResolvedValueOnce(successResponse());
    const content = <ReportWizard userEmail="player@example.com" userName={null} visualStep="review" />;
    const { rerender, container } = render(<Activity mode="visible">{content}</Activity>);
    const draft = container.querySelector(".report-review")!.textContent;
    await user.click(screen.getByRole("button", { name: "Изпрати сигнал" }));
    expect(screen.getByRole("button", { name: "Изпращаме..." })).toBeDisabled();
    await act(async () => { rerender(<Activity mode="hidden">{content}</Activity>); });
    expect(request.mock.calls[0]![1]!.signal!.aborted).toBe(true);
    await act(async () => { rerender(<Activity mode="visible">{content}</Activity>); });
    expect(screen.getByRole("button", { name: "Опитай отново" })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Назад/ })).toBeEnabled();
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(container.querySelector(".report-review")!.textContent).toBe(draft);
    expect(request).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Опитай отново" }));
    expect(request.mock.calls[1]![1]!.headers).toEqual(request.mock.calls[0]![1]!.headers);
    expect(screen.getByText("СИГ-0123456789")).toBeInTheDocument();
  });

  it.each(["request", "body"])("bounds a hung %s, retains the draft and ignores late success during retry", async (phase) => {
    vi.useFakeTimers();
    const schedule = vi.spyOn(globalThis, "setTimeout");
    const cancel = vi.spyOn(globalThis, "clearTimeout");
    let finishFirst!: (value: Response & { referenceId?: string }) => void;
    let finishRetry!: (value: Response) => void;
    const first = new Promise<Response>((resolve) => { finishFirst = resolve; });
    const request = vi.mocked(fetch);
    if (phase === "request") request.mockReturnValueOnce(first);
    else request.mockResolvedValueOnce({ ok: true, json: () => first } as unknown as Response);
    request.mockImplementationOnce(() => new Promise<Response>((resolve) => { finishRetry = resolve; }));
    const { container } = render(<ReportWizard userEmail="player@example.com" userName={null} visualStep="review" />);
    const draft = container.querySelector(".report-review")!.textContent;
    fireEvent.click(screen.getByRole("button", { name: "Изпрати сигнал" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(14_999); });
    expect(screen.getByRole("button", { name: "Изпращаме..." })).toBeDisabled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(screen.getByRole("alert")).toHaveTextContent("Не успяхме да потвърдим изпращането.");
    expect(screen.getByRole("button", { name: /Назад/ })).toBeEnabled();
    expect(container.querySelector("form")).toHaveAttribute("aria-busy", "false");
    expect(container.querySelector(".report-review")!.textContent).toBe(draft);
    expect(request.mock.calls[0]![1]!.signal!.aborted).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Опитай отново" }));
    await act(async () => {});
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1]![1]!.headers).toEqual(request.mock.calls[0]![1]!.headers);
    await act(async () => {
      finishFirst(phase === "request" ? successResponse() : { referenceId: "СИГ-AAAAAAAAAA" } as Response & { referenceId: string });
    });
    expect(screen.queryByRole("heading", { name: "Сигналът е изпратен." })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Изпращаме..." })).toBeDisabled();
    expect(request.mock.calls[1]![1]!.signal!.aborted).toBe(false);
    await act(async () => { finishRetry(successResponse()); });
    expect(screen.getByText("СИГ-0123456789")).toBeInTheDocument();
    const deadlines = schedule.mock.calls.flatMap(([, ms], index) => ms === 15_000 ? [schedule.mock.results[index]!.value] : []);
    expect(deadlines).toHaveLength(2);
    for (const deadline of deadlines) expect(cancel).toHaveBeenCalledWith(deadline);
  });

  it("uses one deadline for headers and body, not a fresh body timeout", async () => {
    vi.useFakeTimers();
    let headers!: (value: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>((resolve) => { headers = resolve; }));
    render(<ReportWizard userEmail={null} userName={null} visualStep="review" />);
    fireEvent.click(screen.getByRole("button", { name: "Изпрати сигнал" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000);
      headers({ ok: true, json: () => new Promise(() => {}) } as unknown as Response);
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });
    expect(screen.getByRole("button", { name: "Опитай отново" })).toBeEnabled();
  });

  it("aborts and clears the deadline on unmount even if fetch ignores cancellation", async () => {
    vi.useFakeTimers();
    let finish!: (value: Response) => void;
    const request = vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }));
    const { unmount } = render(<ReportWizard userEmail={null} userName={null} visualStep="review" />);
    fireEvent.click(screen.getByRole("button", { name: "Изпрати сигнал" }));
    await act(async () => {});
    await act(async () => { unmount(); });
    expect(request.mock.calls[0]![1]!.signal!.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    await act(async () => { finish(successResponse()); });
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["body", "evidence", "email", "identity", "type"])("uses a new key only when submitted %s changes", async (field) => {
    const user = userEvent.setup();
    const request = vi.mocked(fetch);
    render(<ReportWizard userEmail="player@example.com" userName={null} visualStep="review" />);
    await user.click(screen.getByRole("button", { name: "Изпрати сигнал" }));
    const key = () => new Headers(request.mock.calls.at(-1)![1]!.headers).get("Idempotency-Key");
    const firstKey = key();
    expect(firstKey).toMatch(/^[0-9]{13}\.[0-9a-f]{64}$/);
    expect(firstKey).not.toContain("player");
    await user.click(screen.getByRole("button", { name: /Назад/ }));
    await user.click(screen.getByRole("button", { name: /Напред/ }));
    await user.click(screen.getByRole("button", { name: "Изпрати сигнал" }));
    expect(key()).toBe(firstKey);
    await user.click(screen.getByRole("button", { name: /Назад/ }));
    if (field === "email") fireEvent.change(screen.getByRole("textbox", { name: "Твоят имейл" }), { target: { value: "updated@example.com" } });
    else if (field === "identity") await user.click(screen.getByRole("radio", { name: /Анонимно/ }));
    else {
      await user.click(screen.getByRole("button", { name: /Назад/ }));
      if (field === "type") {
        await user.click(screen.getByRole("button", { name: /Назад/ }));
        await user.click(screen.getByRole("radio", { name: /Технически проблем/ }));
        await user.click(screen.getByRole("button", { name: /Напред/ }));
      } else {
        fireEvent.change(screen.getByRole("textbox", { name: field === "body" ? "Описание" : /Код на стая/ }), {
          target: { value: field === "body" ? description : "XYZ789, 20:00" },
        });
      }
      await user.click(screen.getByRole("button", { name: /Напред/ }));
    }
    await user.click(screen.getByRole("button", { name: /Напред/ }));
    await user.click(screen.getByRole("button", { name: "Изпрати сигнал" }));
    expect(key()).not.toBe(firstKey);
  });

  it("retains the key through malformed confirmation, rate limiting and elapsed time", async () => {
    const user = userEvent.setup();
    const request = vi.mocked(fetch)
      .mockResolvedValueOnce(new Response("{}", { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 429 }))
      .mockResolvedValueOnce(successResponse());
    render(<ReportWizard userEmail={null} userName={null} visualStep="review" />);
    await user.click(screen.getByRole("button", { name: "Изпрати сигнал" }));
    await user.click(screen.getByRole("button", { name: "Опитай отново" }));
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 24 * 60 * 60 * 1000);
    await user.click(screen.getByRole("button", { name: "Опитай отново" }));
    expect(request.mock.calls[1]![1]!.headers).toEqual(request.mock.calls[0]![1]!.headers);
    expect(request.mock.calls[2]![1]!.headers).toEqual(request.mock.calls[0]![1]!.headers);
  });

  it("restores the original key after editing and submitting another payload, without a text history", async () => {
    const user = userEvent.setup();
    const request = vi.mocked(fetch);
    render(<ReportWizard userEmail={null} userName={null} visualStep="review" />);
    await user.click(screen.getByRole("button", { name: "Изпрати сигнал" }));
    const original = JSON.parse(request.mock.calls[0]![1]!.body as string) as { body: string };
    for (const value of [` ${original.body} `, description, original.body]) {
      await user.click(screen.getByRole("button", { name: /Назад/ }));
      await user.click(screen.getByRole("button", { name: /Назад/ }));
      fireEvent.change(screen.getByRole("textbox", { name: "Описание" }), { target: { value } });
      await user.click(screen.getByRole("button", { name: /Напред/ }));
      await user.click(screen.getByRole("button", { name: /Напред/ }));
      await user.click(screen.getByRole("button", { name: "Изпрати сигнал" }));
    }
    expect(request.mock.calls[1]![1]!.headers).toEqual(request.mock.calls[0]![1]!.headers);
    expect(request.mock.calls[2]![1]!.headers).not.toEqual(request.mock.calls[0]![1]!.headers);
    expect(request.mock.calls[3]![1]!.headers).toEqual(request.mock.calls[0]![1]!.headers);
  });

  it("uses different keys for separate drafts with identical report text", async () => {
    const user = userEvent.setup();
    const request = vi.mocked(fetch);
    const { unmount } = render(<ReportWizard userEmail={null} userName={null} visualStep="review" />);
    await user.click(screen.getByRole("button", { name: "Изпрати сигнал" }));
    unmount();
    render(<ReportWizard userEmail={null} userName={null} visualStep="review" />);
    await user.click(screen.getByRole("button", { name: "Изпрати сигнал" }));
    expect(request.mock.calls[1]![1]!.body).toBe(request.mock.calls[0]![1]!.body);
    expect(request.mock.calls[1]![1]!.headers).not.toEqual(request.mock.calls[0]![1]!.headers);
  });
});
