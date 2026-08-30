import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
});
