import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PublicEventLine } from "@/components/play/PublicEventLine";

describe("PublicEventLine", () => {
  it("identifies the public event without relying on color or a decorative thumbnail", () => {
    render(<PublicEventLine event={{ id: "death-1", type: "death", messageBg: "Вера напусна играта." }} />);
    expect(screen.getByText("Вера напусна играта.")).toBeVisible();
    expect(document.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders player-provided text as text, not markup", () => {
    render(<PublicEventLine event={{ id: "vote-1", type: "vote", messageBg: "<script>глас</script>" }} />);
    expect(screen.getByText(/<script>глас<\/script>/)).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
  });
});
