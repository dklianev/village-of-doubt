import { StrictMode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authClient } from "@/lib/auth-client";
import { VerifyEmailClient } from "../VerifyEmailClient";

let query = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => query,
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    verifyEmail: vi.fn(),
  },
}));

const verifyEmailMock = vi.mocked(authClient.verifyEmail);

describe("VerifyEmailClient", () => {
  beforeEach(() => {
    query = new URLSearchParams();
    verifyEmailMock.mockReset();
  });

  it("replaces the loading headline after verification settles with an error", async () => {
    render(<VerifyEmailClient />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Печатът не беше поставен." }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Притискаме печата...")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Този линк е празен или повреден.");
  });

  it("submits a valid token only once during the Strict Mode effect replay", async () => {
    query = new URLSearchParams("token=single-use-token");
    verifyEmailMock.mockResolvedValue({ data: { status: true }, error: null } as never);

    render(
      <StrictMode>
        <VerifyEmailClient />
      </StrictMode>,
    );

    expect(
      await screen.findByRole("heading", { level: 1, name: "Печатът е поставен." }),
    ).toBeInTheDocument();
    expect(verifyEmailMock).toHaveBeenCalledTimes(1);
    expect(verifyEmailMock).toHaveBeenCalledWith({ query: { token: "single-use-token" } });
    expect(screen.getByRole("status")).toHaveTextContent("Имейлът е потвърден");
    expect(screen.getByRole("link", { name: "Към началото" })).toHaveAttribute("href", "/");
  });
});
