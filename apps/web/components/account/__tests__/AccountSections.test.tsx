import { Activity, useEffect, useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { AccountSections } from "../AccountSections";

beforeEach(() => { vi.spyOn(window, "scrollTo").mockImplementation(() => {}); });

afterEach(() => {
  window.history.replaceState(null, "", "/");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const sections = {
  chronicle: <p>Игрова история</p>,
  identity: <input aria-label="Име" defaultValue="Мила" />,
  security: <section id="account-data-export">Твоите данни</section>,
};

test("Back from the hero anchor restores the default tab and Forward restores identity", async () => {
  const scroll = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { value: scroll, configurable: true });
  window.history.replaceState(null, "", "/account");
  render(<><a href="#account-identity">Редактирай</a><AccountSections {...sections} /></>);
  expect(screen.getByRole("tab", { name: "Хроника" })).toHaveAttribute("aria-selected", "true");

  await userEvent.click(screen.getByRole("link", { name: "Редактирай" }));
  await waitFor(() => expect(screen.getByRole("tab", { name: "Образ и достъп" })).toHaveAttribute("aria-selected", "true"));
  await waitFor(() => expect(scroll).toHaveBeenCalledOnce());
  scroll.mockClear();

  act(() => window.history.back());
  await waitFor(() => expect(window.location.hash).toBe(""));
  await waitFor(() => expect(screen.getByRole("tab", { name: "Хроника" })).toHaveAttribute("aria-selected", "true"));
  expect(screen.getByRole("tabpanel")).toHaveTextContent("Игрова история");
  expect(scroll).not.toHaveBeenCalled();
  expect(window.scrollTo).not.toHaveBeenCalled();

  act(() => window.history.forward());
  await waitFor(() => expect(window.location.hash).toBe("#account-identity"));
  await waitFor(() => expect(screen.getByRole("tab", { name: "Образ и достъп" })).toHaveAttribute("aria-selected", "true"));
  expect(screen.getByRole("textbox", { name: "Име" })).toBeVisible();
});

test("unsupported anchors do not reset the selected tab", async () => {
  render(<AccountSections {...sections} />);
  await userEvent.click(screen.getByRole("tab", { name: "Данни и сигурност" }));
  window.history.replaceState(null, "", "#unsupported");
  fireEvent(window, new HashChangeEvent("hashchange"));
  expect(screen.getByRole("tab", { name: "Данни и сигурност" })).toHaveAttribute("aria-selected", "true");
});

test("tabs retain drafts and navigate with the keyboard without scrolling", async () => {
  const user = userEvent.setup();
  const scroll = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { value: scroll, configurable: true });
  render(<AccountSections {...sections} />);
  expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
  await user.click(screen.getByRole("tab", { name: "Образ и достъп" }));
  await user.clear(screen.getByLabelText("Име"));
  await user.type(screen.getByLabelText("Име"), "Рада");
  screen.getByRole("tab", { name: "Образ и достъп" }).focus();
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("tab", { name: "Данни и сигурност" })).toHaveFocus();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  await user.keyboard("{ArrowLeft}");
  expect(screen.getByLabelText("Име")).toHaveValue("Рада");
  expect(scroll).not.toHaveBeenCalled();
});

test("section effects pause while hidden and resume with the same React draft", async () => {
  const user = userEvent.setup();
  const activate = vi.fn();
  const deactivate = vi.fn();
  function IdentityDraft() {
    const [name, setName] = useState("Мила");
    useEffect(() => { activate(); return () => { deactivate(); }; }, []);
    return <input aria-label="Име" value={name} onChange={(event) => setName(event.target.value)} />;
  }
  const view = (mode: "visible" | "hidden") => (
    <Activity mode={mode}><AccountSections {...sections} identity={<IdentityDraft />} /></Activity>
  );
  const { rerender } = render(view("visible"));
  expect(activate).not.toHaveBeenCalled();
  await user.click(screen.getByRole("tab", { name: "Образ и достъп" }));
  expect(activate).toHaveBeenCalledOnce();
  await user.type(screen.getByRole("textbox", { name: "Име" }), " draft");

  await user.click(screen.getByRole("tab", { name: "Хроника" }));
  expect(deactivate).toHaveBeenCalledOnce();
  rerender(view("hidden"));
  rerender(view("visible"));
  expect(activate).toHaveBeenCalledOnce();
  expect(deactivate).toHaveBeenCalledOnce();

  await user.click(screen.getByRole("tab", { name: "Образ и достъп" }));
  expect(activate).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("textbox", { name: "Име" })).toHaveValue("Мила draft");
});

test("pending anchor navigation survives an Activity hide and reveal", () => {
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  const scroll = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { value: scroll, configurable: true });
  const view = (mode: "visible" | "hidden") => <Activity mode={mode}><AccountSections {...sections} /></Activity>;
  const { rerender } = render(view("visible"));
  window.history.replaceState(null, "", "#account-data-export");
  fireEvent(window, new HashChangeEvent("hashchange"));
  rerender(view("hidden"));
  rerender(view("visible"));
  act(() => {
    for (const [id, callback] of [...frames]) { frames.delete(id); callback(0); }
  });
  expect(screen.getByRole("tab", { name: "Данни и сигурност" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("tabpanel")).toHaveTextContent("Твоите данни");
  expect(scroll).toHaveBeenCalledWith({ block: "start", behavior: "instant" });
});

test.each(["tab", "anchor"])("returning to an Activity after %s navigation preserves scroll", async (navigation) => {
  const scroll = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { value: scroll, configurable: true });
  if (navigation === "anchor") window.history.replaceState(null, "", "#account-identity");
  const view = (mode: "visible" | "hidden") => <Activity mode={mode}><AccountSections {...sections} /></Activity>;
  const { rerender } = render(view("visible"));
  if (navigation === "tab") await userEvent.click(screen.getByRole("tab", { name: "Образ и достъп" }));
  else await waitFor(() => expect(scroll).toHaveBeenCalledOnce());
  scroll.mockClear();
  vi.stubGlobal("scrollY", 640);
  fireEvent.scroll(window);
  rerender(view("hidden"));
  vi.stubGlobal("scrollY", 0);
  rerender(view("visible"));
  fireEvent(window, new HashChangeEvent("hashchange"));
  await act(async () => { await new Promise<void>((resolve) => requestAnimationFrame(() => resolve())); });
  expect(screen.getByRole("tab", { name: "Образ и достъп" })).toHaveAttribute("aria-selected", "true");
  expect(scroll).not.toHaveBeenCalled();
  expect(window.scrollTo).toHaveBeenCalledWith({ top: 640, left: 0, behavior: "instant" });
  window.history.replaceState(null, "", "#account-data-export");
  fireEvent(window, new HashChangeEvent("hashchange"));
  await waitFor(() => expect(scroll).toHaveBeenCalledOnce());
  expect(screen.getByRole("tab", { name: "Данни и сигурност" })).toHaveAttribute("aria-selected", "true");
});
