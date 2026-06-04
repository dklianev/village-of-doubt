import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConnectionBanner } from "@/components/play/ConnectionBanner";

describe("ConnectionBanner", () => {
  it("stays hidden while the room is connected", () => {
    const { container } = render(<ConnectionBanner status="connected" message="Всичко е спокойно." />);

    expect(container).toBeEmptyDOMElement();
  });

  it("announces reconnecting state politely and marks it as busy", () => {
    render(<ConnectionBanner status="reconnecting" message="Опитваме да се върнем към стаята." />);

    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent("Връзката се възстановява");
    expect(banner).toHaveTextContent("Опитваме да се върнем към стаята.");
    expect(banner).toHaveAttribute("aria-live", "polite");
    expect(banner).toHaveAttribute("aria-busy", "true");
  });

  it("uses assertive alert semantics for connection errors", () => {
    render(<ConnectionBanner status="error" message="Стаята не отговори." />);

    const banner = screen.getByRole("alert");
    expect(banner).toHaveTextContent("Проблем със свързването");
    expect(banner).toHaveAttribute("aria-live", "assertive");
  });
});
