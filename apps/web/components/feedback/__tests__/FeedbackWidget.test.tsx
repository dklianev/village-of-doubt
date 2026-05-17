import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeedbackWidget } from "../FeedbackWidget";

let pathname = "/tutorial";
let session: { user: { email?: string | null; name?: string | null } } | null = null;
let isPending = false;

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: session, isPending }),
  },
}));

describe("FeedbackWidget", () => {
  beforeEach(() => {
    pathname = "/tutorial";
    session = null;
    isPending = false;
    vi.restoreAllMocks();
  });

  it("hides feedback for guests", () => {
    render(<FeedbackWidget />);

    expect(screen.queryByRole("button", { name: "Дай ни бележка" })).not.toBeInTheDocument();
  });

  it("hides feedback on the formal report route", () => {
    pathname = "/report";
    session = { user: { email: "anna@example.com", name: "Анна" } };

    render(<FeedbackWidget />);

    expect(screen.queryByRole("button", { name: "Дай ни бележка" })).not.toBeInTheDocument();
  });

  it("opens for authenticated product routes and submits category context", async () => {
    session = { user: { email: "anna@example.com", name: "Анна" } };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<FeedbackWidget />);
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
