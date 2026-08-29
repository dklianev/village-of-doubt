import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VerifyEmailClient } from "../VerifyEmailClient";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    verifyEmail: vi.fn(),
  },
}));

describe("VerifyEmailClient", () => {
  it("replaces the loading headline after verification settles with an error", async () => {
    render(<VerifyEmailClient />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Печатът не беше поставен." }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Притискаме печата...")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Този линк е празен или повреден.");
  });
});
