import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useReducer, useState } from "react";
import { describe, expect, it } from "vitest";
import { initialState, lobbyFormReducer } from "@/lib/lobby-form";
import { MobileSummaryChip } from "../MobileSummaryChip";
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

function MobileSummaryHarness() {
  const [state, dispatch] = useReducer(lobbyFormReducer, undefined, () => initialState({ family: "werewolves" }));
  return (
    <>
      <a href="/faq">Фоново съдържание</a>
      <MobileSummaryChip state={state} dispatch={dispatch} />
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

  it("isolates the page while the mobile summary sheet is open", async () => {
    const user = userEvent.setup();
    render(<MobileSummaryHarness />);

    const opener = screen.getByRole("button", { name: /играчи/ });
    await user.click(opener);

    const dialog = await screen.findByRole("dialog", { name: "Преглед на стаята" });
    expect(screen.getByText("Фоново съдържание").closest("div")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("button", { name: "Затвори прегледа" })).toHaveFocus();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
  });
});
