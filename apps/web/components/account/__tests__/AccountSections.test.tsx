import { Activity } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { AccountSections } from "../AccountSections";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test("pending section navigation survives an Activity hide and reveal", () => {
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal("matchMedia", () => ({ matches: true }));

  const view = (mode: "visible" | "hidden") => (
    <Activity mode={mode}>
      <AccountSections><section id="account-identity">Профилна редакция</section></AccountSections>
    </Activity>
  );
  const { rerender } = render(view("visible"));
  const navigation = screen.getByRole("navigation", { name: "Раздели на досието" });
  const scroll = vi.fn();
  Object.defineProperty(navigation, "scrollIntoView", { value: scroll, configurable: true });

  fireEvent.click(screen.getByRole("radio", { name: "Образ и достъп" }));
  rerender(view("hidden"));
  rerender(view("visible"));
  act(() => {
    for (const [id, callback] of [...frames]) {
      frames.delete(id);
      callback(0);
    }
  });

  expect(screen.getByRole("radio", { name: "Образ и достъп" })).toBeChecked();
  expect(scroll).toHaveBeenCalledWith({ block: "start", behavior: "instant" });
});
