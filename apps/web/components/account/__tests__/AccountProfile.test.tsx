import { Activity } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authClient } from "@/lib/auth-client";
import { AccountProfile } from "../AccountProfile";
import { AccountIdentity, AccountIdentityProvider } from "../AccountIdentity";

vi.mock("@/lib/auth-client", () => ({ authClient: { updateUser: vi.fn() } }));

describe("AccountProfile save recovery", () => {
  beforeEach(() => { vi.mocked(authClient.updateUser).mockReset(); });

  it("places the sole save action and feedback after the last portrait in keyboard order", async () => {
    const user = userEvent.setup();
    render(<AccountProfile initialName="Мила" initialAvatarId="portrait-f04" email="test@example.invalid" emailVerified providers={["credential"]} />);
    const portraits = screen.getAllByRole("radio");
    const last = portraits.at(-1)!;
    const save = screen.getByRole("button", { name: "Запази досието" });
    expect(last.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.click(last);
    await user.tab();
    expect(save).toHaveFocus();
    expect(save).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("Имаш незапазени промени.");
    expect(save.compareDocumentPosition(screen.getByRole("status")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps edits and permits retry when the network rejects a save", async () => {
    const update = vi.mocked(authClient.updateUser);
    update.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    update.mockResolvedValueOnce({ data: {}, error: null } as never);
    const user = userEvent.setup();
    render(<AccountProfile initialName="Мила" initialAvatarId="portrait-f04" email="private@example.bg" emailVerified providers={["credential"]} />);
    await user.clear(screen.getByLabelText("Име на масата"));
    await user.type(screen.getByLabelText("Име на масата"), "Неда");
    await user.click(screen.getByRole("radio", { name: "Стопанката" }));
    await user.click(screen.getByRole("button", { name: "Запази досието" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/опитай отново/i);
    expect(screen.getByLabelText("Име на масата")).toHaveValue("Неда");
    expect(screen.getByRole("radio", { name: "Стопанката" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Запази досието" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Запази досието" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Запазено");
    expect(screen.getByRole("button", { name: "Запази досието" })).toBeDisabled();
  });

  it("preserves newer edits and updates the header only with the confirmed identity", async () => {
    let resolve!: (value: never) => void;
    vi.mocked(authClient.updateUser).mockReturnValueOnce(new Promise((done) => { resolve = done; }) as never);
    const user = userEvent.setup();
    render(<AccountIdentityProvider initial={{ name: "Мила", avatarId: "portrait-f04" }}>
      <AccountIdentity name="Мила" avatarId="portrait-f04" memberSince={null} />
      <AccountProfile initialName="Мила" initialAvatarId="portrait-f04" email="test@example.invalid" emailVerified providers={["google"]} />
    </AccountIdentityProvider>);
    const name = screen.getByLabelText("Име на масата");
    await user.clear(name);
    await user.type(name, "Рада{Enter}");
    expect(authClient.updateUser).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Мила");
    await user.clear(name);
    await user.type(name, "Следващо име");
    fireEvent.submit(name.closest("form")!);
    expect(authClient.updateUser).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ data: {}, error: null } as never));
    expect(name).toHaveValue("Следващо име");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Рада");
    expect(screen.getByRole("status")).toHaveTextContent("нови незапазени промени");
    expect(screen.getByRole("button", { name: "Запази досието" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Отмени промените" }));
    expect(name).toHaveValue("Рада");
    expect(screen.queryByText("Имейл и парола")).not.toBeInTheDocument();
  });

  it.each(["success", "error", "rejection"] as const)("settles a %s response received while Activity is hidden", async (outcome) => {
    let resolve!: (value: never) => void;
    let reject!: (reason: Error) => void;
    vi.mocked(authClient.updateUser).mockReturnValueOnce(new Promise((done, fail) => { resolve = done; reject = fail; }) as never);
    const user = userEvent.setup();
    const view = (mode: "visible" | "hidden") => <Activity mode={mode}>
      <AccountIdentityProvider initial={{ name: "Мила", avatarId: "portrait-f04" }}>
        <AccountIdentity name="Мила" avatarId="portrait-f04" memberSince={null} />
        <AccountProfile initialName="Мила" initialAvatarId="portrait-f04" email="test@example.invalid" emailVerified providers={["google"]} />
      </AccountIdentityProvider>
    </Activity>;
    const { rerender } = render(view("visible"));
    await user.clear(screen.getByLabelText("Име на масата"));
    await user.type(screen.getByLabelText("Име на масата"), "Рада{Enter}");
    await user.clear(screen.getByLabelText("Име на масата"));
    await user.type(screen.getByLabelText("Име на масата"), "Следващо име");
    rerender(view("hidden"));
    await act(async () => {
      if (outcome === "rejection") reject(new TypeError("Failed to fetch"));
      else resolve({ data: {}, error: outcome === "error" ? { message: "failed" } : null } as never);
    });
    rerender(view("visible"));
    expect(screen.getByLabelText("Име на масата")).toHaveValue("Следващо име");
    expect(screen.getByRole("button", { name: "Запази досието" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Запази досието" })).toHaveAttribute("aria-busy", "false");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(outcome === "success" ? "Рада" : "Мила");
    if (outcome === "success") expect(screen.getByRole("status")).toHaveTextContent("нови незапазени промени");
    else expect(screen.getByRole("alert")).toHaveTextContent(/опитай отново/i);
    vi.mocked(authClient.updateUser).mockResolvedValueOnce({ data: {}, error: null } as never);
    await user.click(screen.getByRole("button", { name: "Запази досието" }));
    expect(authClient.updateUser).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Следващо име");
  });
});
