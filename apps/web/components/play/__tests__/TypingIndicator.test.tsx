import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TypingIndicator } from "@/components/play/TypingIndicator";
import type { TypingNotice } from "@/lib/play/types";

function notice(senderUserId: string, senderName: string): TypingNotice {
  return {
    channel: "dead",
    senderUserId,
    senderName,
    active: true,
    createdAt: 1,
  };
}

describe("TypingIndicator", () => {
  it("renders nothing when nobody is typing", () => {
    const { container } = render(<TypingIndicator notices={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("deduplicates repeated sender notices", () => {
    render(<TypingIndicator notices={[notice("u1", "Анна"), notice("u1", "Анна")]} />);

    expect(screen.getByText("Анна пише...")).toBeInTheDocument();
  });

  it("summarizes multiple typing players", () => {
    render(
      <TypingIndicator
        compact
        notices={[notice("u1", "Анна"), notice("u2", "Борис"), notice("u3", "Вяра"), notice("u4", "Георги")]}
      />,
    );

    expect(screen.getByText("Анна, Борис и още 2 пишат...")).toBeInTheDocument();
  });
});
