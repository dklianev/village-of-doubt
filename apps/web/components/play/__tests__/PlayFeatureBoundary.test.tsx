import { lazy, Suspense, useEffect } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlayFeatureBoundary } from "../PlayFeatureBoundary";

describe("PlayFeatureBoundary", () => {
  it("contains a rejected lazy import without leaving the owning room", async () => {
    const leave = vi.fn();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const Failed = lazy(() => Promise.reject(new Error("Synthetic chunk failure")));
    function Room() {
      useEffect(() => leave, []);
      return <><button>Vote</button><PlayFeatureBoundary fallback={<p>Unavailable</p>}>
        <Suspense fallback={null}><Failed /></Suspense>
      </PlayFeatureBoundary></>;
    }
    try {
      const { unmount } = render(<Room />);
      await screen.findByText("Unavailable");
      expect(screen.getByRole("button", { name: "Vote" })).toBeEnabled();
      expect(leave).not.toHaveBeenCalled();
      unmount();
      await waitFor(() => expect(leave).toHaveBeenCalledTimes(1));
    } finally {
      log.mockRestore();
    }
  });
});
