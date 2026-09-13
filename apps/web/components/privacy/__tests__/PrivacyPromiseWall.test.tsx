import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PrivacyPromiseWall } from "../PrivacyPromiseWall";

describe("privacy promise disclosures", () => {
  it("ships the details in the document and reveals them through the native summary", async () => {
    const user = userEvent.setup();
    render(<PrivacyPromiseWall />);
    const detail = screen.getByText(/Не работим с data brokers\./);
    expect(detail).not.toBeVisible();
    const summary = screen.getAllByText("Виж по-подробно")[0]!;
    await user.click(summary);
    expect(detail).toBeVisible();
    await user.click(summary);
    expect(detail).not.toBeVisible();
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(6);
  });
});
