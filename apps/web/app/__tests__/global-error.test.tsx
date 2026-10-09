import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RootErrorBoundary from "next/dist/client/components/errors/root-error-boundary";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { captureClientException } from "@/lib/sentry-client";
import GlobalError from "../global-error";

vi.mock("@/lib/sentry-client", () => ({
  captureClientException: vi.fn(),
}));

describe("GlobalError", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("announces a page failure, focuses recovery copy, and offers retry, home and report", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    const consoleError = vi.spyOn(console, "error");
    const error = Object.assign(new Error("token=synthetic-secret email=fixture@example.invalid"), { digest: "private-digest" });

    render(<GlobalError error={error} retry={retry} />, { container: document });

    const heading = screen.getByRole("heading", { name: "Страницата не се зареди." });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByRole("alert")).toHaveAccessibleName("Страницата не се зареди.");
    expect(screen.getByRole("alert")).toHaveAccessibleDescription(/Възникна неочакван проблем/);
    expect(document.documentElement).toHaveAttribute("lang", "bg");
    expect(document.title).toBe("Страницата не се зареди | Сенките");
    expect(screen.getByRole("banner", { name: "Сенките" })).toHaveTextContent("Сенките");
    expect(screen.getAllByRole("button")).toHaveLength(1);

    await user.tab();
    expect(screen.getByRole("button", { name: "Опитай отново" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Опитай отново" }));
    expect(retry).toHaveBeenCalledTimes(1);
    await user.tab();
    expect(screen.getByRole("link", { name: "Към началото" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Към началото" })).toHaveFocus();
    await user.tab();
    const report = screen.getByRole("link", { name: "Подай сигнал" });
    expect(report).toHaveFocus();
    expect(report).toHaveAttribute("href", "/report");
    expect(report).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(captureClientException).toHaveBeenCalledWith(error);
    expect(consoleError).not.toHaveBeenCalled();
    expect(document.body.innerHTML).not.toMatch(/synthetic-secret|fixture@example|private-digest|Играта спря/);
  });

  it.each(["light", "dark"])("restores only the saved %s theme without the root layout", (theme) => {
    window.localStorage.setItem("werewolf-theme", theme);
    render(<GlobalError error={new Error("fixture")} retry={vi.fn()} />, { container: document });
    expect(document.documentElement).toHaveAttribute("data-theme", theme);
  });

  it.each([null, "system", "invalid-theme"])("leaves theme resolution to CSS for %s", (theme) => {
    if (theme) window.localStorage.setItem("werewolf-theme", theme);
    render(<GlobalError error={new Error("fixture")} retry={vi.fn()} />, { container: document });
    expect(document.documentElement).not.toHaveAttribute("data-theme");
  });

  it("keeps recovery usable when storage and matchMedia are unavailable", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
    vi.spyOn(window, "matchMedia").mockImplementation(() => { throw new Error("Unavailable"); });
    const retry = vi.fn();
    render(<GlobalError error={new Error("fixture")} retry={retry} />, { container: document });
    expect(document.documentElement).not.toHaveAttribute("data-theme");
    expect(screen.getByRole("heading")).toHaveFocus();
    await userEvent.setup().click(screen.getByRole("button", { name: "Опитай отново" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("refocuses a new failure without stealing focus on unrelated renders", async () => {
    const retry = vi.fn();
    const firstError = new Error("first fixture");
    const { rerender } = render(<GlobalError error={firstError} retry={retry} />, { container: document });
    const button = screen.getByRole("button", { name: "Опитай отново" });
    button.focus();
    rerender(<GlobalError error={firstError} retry={retry} />);
    expect(button).toHaveFocus();
    rerender(<GlobalError error={new Error("second fixture")} retry={retry} />);
    await waitFor(() => expect(screen.getByRole("heading")).toHaveFocus());
  });

  it("recovers an actual Next boundary failure only after retry refreshes its children", async () => {
    const user = userEvent.setup();
    const error = new Error("synthetic layout failure");
    let available = false;
    const refresh = vi.fn(() => { available = true; });
    const router = { refresh } as unknown as AppRouterInstance;
    const onCaughtError = vi.fn();
    function LayoutFixture() {
      if (!available) throw error;
      return <html lang="bg"><body><h1>Възстановена страница</h1></body></html>;
    }

    render(
      <AppRouterContext.Provider value={router}>
        <RootErrorBoundary errorComponent={GlobalError}>
          <LayoutFixture />
        </RootErrorBoundary>
      </AppRouterContext.Provider>,
      { container: document, onCaughtError },
    );
    expect(onCaughtError).toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Страницата не се зареди." })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Опитай отново" }));
    expect(refresh).toHaveBeenCalledOnce();
    expect(await screen.findByRole("heading", { name: "Възстановена страница" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
