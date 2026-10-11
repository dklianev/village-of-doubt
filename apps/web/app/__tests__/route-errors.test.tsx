import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundaryHandler } from "next/dist/client/components/error-boundary";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { afterEach, describe, expect, it, vi } from "vitest";
import { captureClientException } from "@/lib/sentry-client";
import RootError from "../error";
import AccountError from "../account/error";
import AchievementsError from "../achievements/error";
import LeaderboardError from "../leaderboard/error";

vi.mock("@/lib/sentry-client", () => ({ captureClientException: vi.fn() }));

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

const routes = [
  { Component: RootError, pathname: "/history", title: "Страницата не се зареди", description: /тази страница/ },
  { Component: AccountError, pathname: "/account", title: "Досието не се отвори", description: /профила ти/ },
  { Component: AchievementsError, pathname: "/achievements", title: "Легендите не се заредиха", description: /постиженията ти/ },
  { Component: LeaderboardError, pathname: "/leaderboard", title: "Вечерният брой не се зареди", description: /класацията/ },
];

describe.each(routes)("$pathname error boundary", ({ Component, pathname, title, description }) => {
  it("names and focuses the failure, with one retry and safe home and report destinations", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    const consoleError = vi.spyOn(console, "error");
    const error = Object.assign(new Error("token=synthetic-secret email=fixture@example.invalid"), { digest: "private-digest" });
    window.history.replaceState(null, "", `${pathname}?token=synthetic-secret#private-fragment`);
    render(<Component error={error} retry={retry} />);

    const alert = screen.getByRole("alert", { name: title });
    expect(alert).toHaveClass("route-error-card");
    expect(alert).not.toHaveClass("paper-card");
    expect(alert).toHaveAccessibleDescription(description);
    expect(screen.getByRole("heading", { name: title })).toHaveFocus();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    await user.tab();
    expect(screen.getByRole("button", { name: "Опитай отново" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(retry).toHaveBeenCalledOnce();
    await user.tab();
    const home = screen.getByRole("link", { name: "Към началото" });
    expect(home).toHaveFocus();
    expect(home).toHaveAttribute("href", "/");
    expect(home).toHaveAttribute("referrerpolicy", "no-referrer");
    await user.tab();
    const report = screen.getByRole("link", { name: "Подай сигнал" });
    expect(report).toHaveFocus();
    expect(report).toHaveAttribute("href", "/report");
    expect(report).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(captureClientException).toHaveBeenCalledWith(error);
    expect(consoleError).not.toHaveBeenCalled();
    expect(document.body.innerHTML).not.toMatch(/synthetic-secret|fixture@example|private-digest|private-fragment|напускаш масата/);
  });

  it("focuses a new error but does not steal focus during a normal re-render", async () => {
    const retry = vi.fn();
    const error = new Error("first fixture");
    const { rerender } = render(<Component error={error} retry={retry} />);
    const button = screen.getByRole("button", { name: "Опитай отново" });
    button.focus();
    rerender(<Component error={error} retry={retry} />);
    expect(button).toHaveFocus();
    rerender(<Component error={new Error("second fixture")} retry={retry} />);
    await waitFor(() => expect(screen.getByRole("heading", { name: title })).toHaveFocus());
  });

  it("uses installed Next retry to refresh, preserves chrome, and keeps a repeated failure distinct from empty", async () => {
    const user = userEvent.setup();
    const error = new Error("synthetic unavailable data");
    let available = false;
    const refresh = vi.fn();
    const router = { refresh } as unknown as AppRouterInstance;
    const onCaughtError = vi.fn();
    function PageFixture() {
      if (!available) throw error;
      return <main><h1>Заредени данни</h1></main>;
    }

    render(
      <AppRouterContext.Provider value={router}>
        <header><a href="/">SENKITE</a></header>
        <ErrorBoundaryHandler pathname={pathname} errorComponent={Component}>
          <PageFixture />
        </ErrorBoundaryHandler>
        <footer>Сенките</footer>
      </AppRouterContext.Provider>,
      { onCaughtError },
    );
    const header = screen.getByRole("banner");
    const footer = screen.getByRole("contentinfo");
    expect(onCaughtError).toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: title })).toHaveFocus();
    expect(refresh).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Опитай отново" }));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert", { name: title })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Заредени данни" })).not.toBeInTheDocument();

    refresh.mockImplementation(() => { available = true; });
    await user.click(screen.getByRole("button", { name: "Опитай отново" }));
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole("heading", { name: "Заредени данни" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("banner")).toBe(header);
    expect(screen.getByRole("contentinfo")).toBe(footer);
  });
});
