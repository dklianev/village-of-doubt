import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { RoleDetailModal } from "../RoleDetailModal";

function RoleDetailHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Отвори ролята
      </button>
      {open ? <RoleDetailModal family="werewolves" role="seer" onClose={() => setOpen(false)} /> : null}
    </>
  );
}

describe("lobby modal focus", () => {
  it("focuses the visible role action instead of the invisible backdrop", async () => {
    const user = userEvent.setup();
    render(<RoleDetailHarness />);

    const opener = screen.getByRole("button", { name: "Отвори ролята" });
    await user.click(opener);

    await waitFor(() => expect(screen.getByRole("button", { name: "Готово" })).toHaveFocus());
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
  });
});
