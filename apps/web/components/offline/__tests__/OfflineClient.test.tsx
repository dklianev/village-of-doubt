import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OfflineClient } from "@/components/offline-client";

vi.mock("next/image", () => ({
  default: ({ fill: _fill, priority: _priority, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    priority?: boolean;
  }) => <img {...props} />,
}));

describe("OfflineClient", () => {
  it("does not offer navigation links that resolve back to the offline fallback", () => {
    render(<OfflineClient />);

    expect(screen.getByRole("button", { name: "Провери връзката" })).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
