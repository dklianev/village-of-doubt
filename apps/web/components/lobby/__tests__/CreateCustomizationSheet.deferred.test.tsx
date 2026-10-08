import { Activity, StrictMode } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LobbyWizard } from "../LobbyWizard";
import { CreateCustomizationContent } from "../CreateCustomizationContent";
import { loadCreateCustomizationContent } from "../create-customization-deferred";

vi.mock("../create-customization-deferred", () => ({ loadCreateCustomizationContent: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function deferred() {
  let resolve!: (content: typeof CreateCustomizationContent) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<typeof CreateCustomizationContent>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const dialogName = "Настрой детайлите";

describe("Create customization deferred content", () => {
  beforeEach(() => vi.mocked(loadCreateCustomizationContent).mockReset());

  it.each(["werewolves", "mafia"] as const)("opens the %s shell immediately and keeps its dialog, tabs, focus and state when loading completes", async (family) => {
    const pending = deferred();
    vi.mocked(loadCreateCustomizationContent).mockReturnValue(pending.promise);
    const user = userEvent.setup();
    render(<LobbyWizard family={family} />);
    expect(loadCreateCustomizationContent).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Увеличи броя играчи" }));
    const playerCount = screen.getByRole("slider", { name: "Брой играчи" }).getAttribute("value");
    const trigger = screen.getByRole("button", { name: dialogName });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: dialogName });
    const panel = within(dialog).getByRole("tabpanel");
    const close = within(dialog).getByRole("button", { name: "Затвори настройките" });
    expect(dialog).toHaveAttribute("data-size", "workspace");
    expect(close).toHaveFocus();
    expect(within(dialog).getByRole("status")).toHaveTextContent("Зареждаме настройките...");
    expect(panel).toHaveAttribute("aria-busy", "true");
    expect(loadCreateCustomizationContent).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 8; i += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
    await user.click(within(dialog).getByRole("tab", { name: "Роли" }));
    await user.keyboard("{End}");
    const inviteTab = within(dialog).getByRole("tab", { name: "Име на стаята" });
    await waitFor(() => expect(inviteTab).toHaveFocus());
    expect(inviteTab).toHaveAttribute("aria-selected", "true");
    await act(async () => pending.resolve(CreateCustomizationContent));

    expect(screen.getByRole("dialog", { name: dialogName })).toBe(dialog);
    expect(within(dialog).getByRole("tabpanel")).toBe(panel);
    expect(within(dialog).getByRole("button", { name: "Затвори настройките" })).toBe(close);
    expect(inviteTab).toHaveFocus();
    expect(panel).toHaveAttribute("aria-busy", "false");
    const input = within(dialog).getByRole("textbox", { name: "Име на стаята" });
    await user.clear(input);
    await user.type(input, "Вечер край реката");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    expect(screen.getByRole("slider", { name: "Брой играчи" })).toHaveValue(playerCount);

    await user.click(trigger);
    const reopened = screen.getByRole("dialog", { name: dialogName });
    expect(within(reopened).getByRole("tab", { name: "Име на стаята" })).toHaveAttribute("aria-selected", "true");
    expect(within(reopened).getByRole("textbox", { name: "Име на стаята" })).toHaveValue("Вечер край реката");
    expect(loadCreateCustomizationContent).toHaveBeenCalledTimes(1);
  });

  it.each(["escape", "close", "done"] as const)("closes with %s during loading and never reopens when that request resolves", async (method) => {
    const first = deferred();
    const second = deferred();
    vi.mocked(loadCreateCustomizationContent).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const user = userEvent.setup();
    render(<LobbyWizard family="werewolves" />);
    const trigger = screen.getByRole("button", { name: dialogName });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: dialogName });
    await user.click(within(dialog).getByRole("tab", { name: "Име на стаята" }));
    if (method === "escape") await user.keyboard("{Escape}");
    else await user.click(within(dialog).getByRole("button", { name: method === "close" ? "Затвори настройките" : "Готово" }));
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    await act(async () => first.resolve(CreateCustomizationContent));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    expect(screen.getByRole("status")).toHaveTextContent("Зареждаме настройките...");
    expect(screen.getByRole("tab", { name: "Име на стаята" })).toHaveAttribute("aria-selected", "true");
    await act(async () => second.resolve(CreateCustomizationContent));
    expect(screen.getByRole("textbox", { name: "Име на стаята" })).toBeVisible();
    expect(loadCreateCustomizationContent).toHaveBeenCalledTimes(2);
  });

  it.each(["resolve", "reject"] as const)("ignores a closed request's late %s after a new opening", async (outcome) => {
    const first = deferred();
    const second = deferred();
    vi.mocked(loadCreateCustomizationContent).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const user = userEvent.setup();
    render(<LobbyWizard family="mafia" />);
    const trigger = screen.getByRole("button", { name: dialogName });
    await user.click(trigger);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(trigger);
    await user.click(screen.getByRole("tab", { name: "Име на стаята" }));
    await act(async () => {
      if (outcome === "resolve") first.resolve(() => <p>Stale content</p>);
      else first.reject(new Error("late chunk failure"));
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("Stale content")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Зареждаме настройките...");
    await act(async () => second.resolve(CreateCustomizationContent));
    expect(screen.getByRole("textbox", { name: "Име на стаята" })).toBeVisible();
  });

  it("reimports after repeated failures without replacing the modal or losing the selected tab and edited roster", async () => {
    const first = deferred();
    const second = deferred();
    const third = deferred();
    vi.mocked(loadCreateCustomizationContent).mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise).mockReturnValueOnce(third.promise);
    const user = userEvent.setup();
    render(<LobbyWizard family="werewolves" />);
    await user.click(screen.getByRole("button", { name: "Увеличи броя играчи" }));
    await user.click(screen.getByRole("button", { name: "На живо" }));
    await user.click(screen.getByRole("button", { name: dialogName }));
    const dialog = screen.getByRole("dialog", { name: dialogName });
    const panel = within(dialog).getByRole("tabpanel");
    await user.click(within(dialog).getByRole("tab", { name: "Име на стаята" }));
    await act(async () => first.reject(new Error("chunk unavailable")));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Настройките не се заредиха.");
    expect(panel).toHaveAttribute("aria-busy", "false");
    await user.click(within(dialog).getByRole("button", { name: "Опитай отново" }));
    expect(panel).toHaveFocus();
    expect(panel).toHaveAttribute("aria-busy", "true");
    await act(async () => second.reject(new Error("still unavailable")));
    await user.click(within(dialog).getByRole("button", { name: "Опитай отново" }));
    await act(async () => third.resolve(CreateCustomizationContent));
    expect(screen.getByRole("dialog", { name: dialogName })).toBe(dialog);
    expect(panel).toHaveFocus();
    expect(within(dialog).getByRole("tab", { name: "Име на стаята" })).toHaveAttribute("aria-selected", "true");
    expect(within(dialog).getByRole("textbox", { name: "Име на стаята" })).toBeVisible();
    expect(loadCreateCustomizationContent).toHaveBeenCalledTimes(3);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(screen.getByRole("slider", { name: "Брой играчи" })).toHaveValue("13");
    expect(screen.getByRole("button", { name: "На живо" })).toHaveAttribute("aria-pressed", "true");
  });

  it("can dismiss an error with Escape and tries again on reopening", async () => {
    const first = deferred();
    vi.mocked(loadCreateCustomizationContent).mockReturnValueOnce(first.promise).mockResolvedValue(CreateCustomizationContent);
    const user = userEvent.setup();
    render(<LobbyWizard family="werewolves" />);
    const trigger = screen.getByRole("button", { name: dialogName });
    await user.click(trigger);
    await user.click(screen.getByRole("tab", { name: "Име на стаята" }));
    await act(async () => first.reject(new Error("offline")));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    expect(await screen.findByRole("textbox", { name: "Име на стаята" })).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(loadCreateCustomizationContent).toHaveBeenCalledTimes(2);
  });

  it("ignores a pending import while Activity hides the setup and resumes with its retained tab", async () => {
    const first = deferred();
    vi.mocked(loadCreateCustomizationContent).mockReturnValue(first.promise);
    const user = userEvent.setup();
    const view = (mode: "visible" | "hidden") => <StrictMode>
      <Activity mode={mode}><LobbyWizard family="werewolves" /></Activity>
    </StrictMode>;
    const { rerender } = render(view("visible"));
    await user.click(screen.getByRole("button", { name: dialogName }));
    await user.click(screen.getByRole("tab", { name: "Име на стаята" }));
    rerender(view("hidden"));
    await act(async () => first.resolve(() => <p>Stale content</p>));
    vi.mocked(loadCreateCustomizationContent).mockResolvedValue(CreateCustomizationContent);
    rerender(view("visible"));
    expect(await screen.findByRole("textbox", { name: "Име на стаята" })).toBeVisible();
    expect(screen.queryByText("Stale content")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Име на стаята" })).toHaveAttribute("aria-selected", "true");
  });
});
