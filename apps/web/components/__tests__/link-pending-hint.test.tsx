import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LinkPendingHint } from "../navigation-telemetry";

vi.mock("next/navigation", () => ({ usePathname: () => "/history" }));

vi.mock("@/lib/sentry-client", () => ({ captureNavigationMetric: vi.fn() }));

vi.mock("@/lib/navigation-telemetry", () => ({ completeNavigationTransition: vi.fn(() => null) }));

const { useLinkStatus } = vi.hoisted(() => ({
  useLinkStatus: vi.fn(() => ({ pending: false })),
}));

vi.mock("next/link", () => ({ useLinkStatus }));

describe("LinkPendingHint", () => {
  beforeEach(() => useLinkStatus.mockReturnValue({ pending: false }));

  it("пази стабилно място без видим индикатор в покой", () => {
    const { container } = render(<LinkPendingHint />);

    expect(container.querySelector("[data-link-pending]")).not.toBeNull();
    expect(container.querySelector("[data-link-pending]")).toHaveAttribute("data-visible", "false");
  });

  it("показва незабавен индикатор по време на Link навигация", () => {
    useLinkStatus.mockReturnValue({ pending: true });
    const { container } = render(<LinkPendingHint />);

    expect(container.querySelector("[data-link-pending]")).toHaveAttribute("data-visible", "true");
  });
});
