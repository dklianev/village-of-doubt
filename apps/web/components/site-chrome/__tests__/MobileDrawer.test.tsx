import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { MobileDrawer } from "../MobileDrawer";

vi.mock("@/components/site-chrome/AuthChip", () => ({
  AuthChip: () => <a href="/sign-in">Влез</a>,
}));

function DrawerHarness() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={triggerRef} type="button" onClick={() => setOpen(true)}>
        Отвори менюто
      </button>
      <a href="/tutorial">Фоново съдържание</a>
      <MobileDrawer
        open={open}
        pathname="/"
        soundEnabled={false}
        themePreference="dark"
        playHref="/werewolf/create"
        initialSession={null}
        triggerRef={triggerRef}
        onOpenChange={setOpen}
        onToggleSound={() => {}}
        onCycleTheme={() => {}}
      />
    </>
  );
}

describe("MobileDrawer", () => {
  it("uses a modal sheet, isolates the page, and restores focus to its opener", async () => {
    const user = userEvent.setup();
    render(<DrawerHarness />);

    const opener = screen.getByRole("button", { name: "Отвори менюто" });
    await user.click(opener);

    const dialog = await screen.findByRole("dialog", { name: "Навигация" });
    expect(dialog).toContainElement(screen.getByRole("link", { name: "Влез" }));
    expect(screen.getByText("Фоново съдържание").closest("div")?.getAttribute("aria-hidden")).toBe("true");

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Навигация" })).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
  });

  it("does not override the design-system Sheet identity from consumer CSS", () => {
    const chromeCss = readFileSync(resolve(process.cwd(), "components/site-chrome/SiteChrome.module.css"), "utf8");

    expect(chromeCss).not.toMatch(/:global\(\.ds-sheet/);
  });
});
