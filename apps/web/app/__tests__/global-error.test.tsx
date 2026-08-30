import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import GlobalError from "../global-error";

vi.mock("@/lib/sentry-client", () => ({
  captureClientException: vi.fn(),
}));

describe("GlobalError", () => {
  it("announces the failure, focuses recovery copy, and offers three exits", async () => {
    const user = userEvent.setup();
    const reset = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(<GlobalError error={new Error("boom")} reset={reset} />);

    const heading = screen.getByRole("heading", { name: "Играта спря за момент." });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByRole("alert")).toHaveAccessibleName("Играта спря за момент.");

    await user.click(screen.getByRole("button", { name: "Опитай отново" }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Презареди страницата" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Към началото" })).toHaveAttribute("href", "/");
  });
});
