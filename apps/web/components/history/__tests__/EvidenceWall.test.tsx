import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EvidenceWall } from "../EvidenceWall";

describe("EvidenceWall route states", () => {
  it("distinguishes an unavailable archive from an empty archive", () => {
    const { rerender } = render(<EvidenceWall games={[]} status="unavailable" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Архивът не отговори");
    expect(screen.queryByText("Първата нощ ще остави следа тук.")).not.toBeInTheDocument();

    rerender(<EvidenceWall games={[]} status="ready" />);

    expect(screen.getByText("Първата нощ ще остави следа тук.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
