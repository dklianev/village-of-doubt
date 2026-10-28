import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { FeedbackWidget } from "../FeedbackWidget";

let pathname = "/tutorial";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

describe("FeedbackWidget", () => {
  beforeEach(() => {
    pathname = "/tutorial";
    vi.restoreAllMocks();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("hides feedback for guests", () => {
    render(<FeedbackWidget session={{ user: { id: "" } }} />);

    expect(screen.queryByRole("button", { name: "Дай ни бележка" })).not.toBeInTheDocument();
  });

  it.each(["/privacy", "/terms", "/faq", "/status", "/report"])(
    "shows feedback on the service route %s",
    (servicePath) => {
      pathname = servicePath;

      render(<FeedbackWidget session={{ user: { id: "user-1", email: "anna@example.com", name: "Анна" } }} />);

      expect(screen.getByRole("button", { name: "Дай ни бележка" })).toBeInTheDocument();
    },
  );

  it("opens for authenticated product routes and submits category context", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<FeedbackWidget session={{ user: { id: "user-1", email: "anna@example.com", name: "Анна" } }} />);
    await user.click(screen.getByRole("button", { name: "Дай ни бележка" }));

    expect(screen.getByRole("dialog", { name: "Дай ни бележка." })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(/Имейл за връзка/)).toHaveValue("anna@example.com"));

    await user.click(screen.getByText("Идея"));
    await user.type(screen.getByLabelText("Описание"), "Нека има още настройки за масата.");
    await user.click(screen.getByRole("button", { name: "Изпрати" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const payload = JSON.parse(String(init.body));
    expect(payload).toMatchObject({
      category: "idea",
      body: "Нека има още настройки за масата.",
      email: "anna@example.com",
      page: "/tutorial",
    });
  });

  it.each(["Escape", "Отказ", "Затвори"] as const)("returns focus to the feedback button after closing with %s", async (control) => {
    const user = userEvent.setup();
    render(<FeedbackWidget session={{ user: { id: "user-1", email: "anna@example.com" } }} />);
    await user.click(screen.getByRole("button", { name: "Дай ни бележка" }));
    await screen.findByRole("dialog", { name: "Дай ни бележка." });

    if (control === "Escape") await user.keyboard("{Escape}");
    else await user.click(screen.getByRole("button", { name: control }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Дай ни бележка" })).toHaveFocus();
  });

  it("hides the page behind the open panel but keeps the dimmed backdrop clickable", async () => {
    const page = document.createElement("main");
    page.innerHTML = '<button type="button">Страница</button>';
    document.body.append(page);
    onTestFinished(() => page.remove());
    const user = userEvent.setup();
    render(<FeedbackWidget session={{ user: { id: "user-1", email: "anna@example.com" } }} />);
    await user.click(screen.getByRole("button", { name: "Дай ни бележка" }));
    const dialog = await screen.findByRole("dialog", { name: "Дай ни бележка." });
    const backdrop = dialog.previousElementSibling as HTMLElement;

    expect(page).toHaveAttribute("inert");
    expect(screen.queryByRole("button", { name: "Страница" })).not.toBeInTheDocument();
    expect(backdrop.closest("[inert]")).toBeNull();

    await user.click(backdrop);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(page).not.toHaveAttribute("inert");
    expect(screen.getByRole("button", { name: "Дай ни бележка" })).toHaveFocus();
  });

  it("keeps focus inside the panel while sending and moves it to the confirmation", async () => {
    const pending = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn(() => pending.promise));
    const user = userEvent.setup();
    render(<FeedbackWidget session={{ user: { id: "user-1", email: "anna@example.com" } }} />);
    await user.click(screen.getByRole("button", { name: "Дай ни бележка" }));
    await user.type(screen.getByLabelText("Описание"), "Таймерът изчезва при обръщане.");
    await user.click(screen.getByRole("button", { name: "Изпрати" }));

    const sending = screen.getByRole("button", { name: "Изпращаме..." });
    expect(sending).toHaveAttribute("aria-disabled", "true");
    expect(sending).toHaveFocus();

    await act(async () => pending.resolve(new Response(null, { status: 200 })));
    expect(screen.getByText("Получено. Благодарим.")).toHaveFocus();
  });

  it("lets the optional email stay empty after the prefill is cleared", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<FeedbackWidget session={{ user: { id: "user-1", email: "anna@example.com" } }} />);
    await user.click(screen.getByRole("button", { name: "Дай ни бележка" }));
    const email = screen.getByLabelText(/Имейл за връзка/);
    await waitFor(() => expect(email).toHaveValue("anna@example.com"));

    await user.clear(email);
    expect(email).toHaveValue("");
    await user.type(screen.getByLabelText("Описание"), "Анонимна бележка за масата.");
    expect(email).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "Изпрати" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({ email: null });
  });

  it.each(["close", "route"] as const)("locks the submitted draft across %s/reopen until success", async (dismissal) => {
    const pending = deferred<Response>();
    const fetchMock = vi.fn(() => pending.promise);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    const session = { user: { id: "synthetic-user", email: "original@example.invalid" } };
    const { rerender } = render(<FeedbackWidget session={session} />);
    await user.click(screen.getByRole("button", { name: "Дай ни бележка" }));
    await user.click(screen.getByRole("radio", { name: /Идея/ }));
    await user.type(screen.getByLabelText("Описание"), "Original synthetic feedback");
    await user.click(screen.getByRole("button", { name: "Изпрати" }));

    const body = screen.getByLabelText("Описание");
    expect(body).toBeDisabled();
    expect(screen.getByLabelText(/Имейл за връзка/)).toBeDisabled();
    for (const radio of screen.getAllByRole("radio")) expect(radio).toBeDisabled();
    await user.type(body, "New unsent text");
    await user.type(screen.getByLabelText(/Имейл за връзка/), "changed@example.invalid");
    await user.click(screen.getByRole("radio", { name: /Похвала/ }));
    expect(body).toHaveValue("Original synthetic feedback");
    expect(screen.getByRole("radio", { name: /Идея/ })).toBeChecked();
    fireEvent.submit(body.closest("form")!);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    if (dismissal === "close") await user.click(screen.getByRole("button", { name: "Затвори" }));
    else {
      pathname = "/sign-in";
      rerender(<FeedbackWidget session={session} />);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      pathname = "/tutorial";
      rerender(<FeedbackWidget session={session} />);
    }
    await user.click(screen.getByRole("button", { name: "Дай ни бележка" }));
    expect(screen.getByLabelText("Описание")).toBeDisabled();
    expect(screen.getByLabelText("Описание")).toHaveValue("Original synthetic feedback");
    await act(async () => pending.resolve(new Response(null, { status: 200 })));
    expect(screen.getByRole("status")).toHaveTextContent("original@example.invalid");
    await user.click(screen.getByRole("button", { name: "Затвори" }));
    await user.click(screen.getByRole("button", { name: "Дай ни бележка" }));
    expect(screen.getByLabelText("Описание")).toBeEnabled();
    expect(screen.getByLabelText("Описание")).toHaveValue("");
  });

  it.each(["http", "network"] as const)("preserves and unlocks the draft after a %s failure", async (failure) => {
    const pending = deferred<Response>();
    const fetchMock = vi.fn<typeof fetch>().mockReturnValueOnce(pending.promise)
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<FeedbackWidget session={{ user: { id: "synthetic-user", email: "original@example.invalid" } }} />);
    await user.click(screen.getByRole("button", { name: "Дай ни бележка" }));
    await user.click(screen.getByRole("radio", { name: /Идея/ }));
    await user.type(screen.getByLabelText("Описание"), "Original synthetic feedback");
    await user.click(screen.getByRole("button", { name: "Изпрати" }));
    await act(async () => {
      if (failure === "network") pending.reject(new TypeError("synthetic network failure"));
      else pending.resolve(new Response(JSON.stringify({ error: "Synthetic retry error" }), { status: 503 }));
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByLabelText("Описание")).toHaveValue("Original synthetic feedback");
    expect(screen.getByLabelText("Описание")).toBeEnabled();
    expect(screen.getByLabelText(/Имейл за връзка/)).toBeEnabled();
    expect(screen.getByLabelText(/Имейл за връзка/)).toHaveValue("original@example.invalid");
    expect(screen.getByRole("radio", { name: /Идея/ })).toBeChecked();
    for (const radio of screen.getAllByRole("radio")) expect(radio).toBeEnabled();
    await user.type(screen.getByLabelText("Описание"), " revised");
    await user.click(screen.getByRole("button", { name: "Изпрати" }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toMatchObject({
      category: "idea", body: "Original synthetic feedback revised", email: "original@example.invalid",
    });
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}
