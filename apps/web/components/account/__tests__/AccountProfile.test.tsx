import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authClient } from "@/lib/auth-client";
import { AccountProfile } from "../AccountProfile";

vi.mock("@/lib/auth-client", () => ({ authClient: { updateUser: vi.fn() } }));

describe("AccountProfile save recovery", () => {
  beforeEach(() => { vi.mocked(authClient.updateUser).mockReset(); });

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
});
