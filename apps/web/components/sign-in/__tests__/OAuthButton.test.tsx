import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OAuthButton } from "../OAuthButton";

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      social: vi.fn(() => Promise.resolve({ data: null, error: null })),
    },
  },
}));

describe("OAuthButton", () => {
  it("shows the Google label", () => {
    render(<OAuthButton provider="google" redirectTo="/" />);

    expect(screen.getByText("Продължи с Google")).toBeInTheDocument();
  });

  it("shows the Discord label", () => {
    render(<OAuthButton provider="discord" redirectTo="/" />);

    expect(screen.getByText("Продължи с Discord")).toBeInTheDocument();
  });

  it("starts the social sign-in flow on click", async () => {
    const { authClient } = await import("@/lib/auth-client");
    const user = userEvent.setup();
    render(<OAuthButton provider="google" redirectTo="/play/ABC123" />);

    await user.click(screen.getByRole("button", { name: "Продължи с Google" }));

    expect(authClient.signIn.social).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/play/ABC123",
    });
  });
});
