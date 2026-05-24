import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoverCard } from "@/components/play/LoverCard";

describe("LoverCard", () => {
  it("renders the private lover pairing without exposing ids", () => {
    render(<LoverCard lover={{ loverUserId: "secret-user-id", loverName: "Мила" }} />);

    expect(screen.getByText("само за теб")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Влюбен си в Мила" })).toBeInTheDocument();
    expect(screen.getByText(/ако един от вас умре/i)).toBeInTheDocument();
    expect(screen.queryByText("secret-user-id")).not.toBeInTheDocument();
  });
});
