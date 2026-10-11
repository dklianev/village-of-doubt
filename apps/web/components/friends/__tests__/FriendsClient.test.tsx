import { Activity } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FriendsBook as FriendsClient } from "../FriendsBook";
import { safeLocalStorage } from "@/lib/safe-storage";
import { copyTextToClipboard } from "@/lib/clipboard";
import { FRIENDS_STORAGE_KEY, FRIENDS_BACKUP_KEY, MAX_FRIENDS } from "../friends-storage";

vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: vi.fn().mockResolvedValue(undefined) }));
const mila = { id: "synthetic-mila", name: "Мила", note: "Обича да е разказвач" };
const boris = { id: "synthetic-boris", name: "Борис", note: "Играе вечер" };
const seed = (friends = [mila, boris]) => localStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify(friends));
const saved = () => JSON.parse(localStorage.getItem(FRIENDS_STORAGE_KEY)!);
const fillName = (name: string) => fireEvent.change(screen.getByRole("textbox", { name: "Име" }), { target: { value: name } });
const addTrigger = () => within(screen.getByRole("region", { name: "Твоята компания" })).getByRole("button", { name: "Добави име" });
const openAdd = () => fireEvent.click(addTrigger());
const add = () => fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Добави име" }));
const closeForm = () => fireEvent.click(screen.getByRole("button", { name: "Затвори" }));
const edit = (name: string) => {
  if (screen.queryByRole("dialog")) closeForm();
  fireEvent.click(screen.getByRole("button", { name: `Редактирай ${name}` }));
};
const notifyStorage = () => act(() => window.dispatchEvent(new StorageEvent("storage", { key: FRIENDS_STORAGE_KEY })));

describe("FriendsClient", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(copyTextToClipboard).mockReset().mockResolvedValue(undefined);
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  });

  it("shows a local empty ledger with no invented reserved seats or membership", () => {
    render(<FriendsClient />);
    expect(screen.getByRole("region", { name: "Твоята компания" })).toBeInTheDocument();
    expect(screen.getByText("0 имена")).toBeInTheDocument();
    expect(screen.getByText("Само в този браузър")).toBeInTheDocument();
    expect(addTrigger()).toHaveTextContent("Добави име");
    expect(addTrigger()).toHaveAttribute("autocomplete", "off");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Име" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Още няма вписани имена" })).toBeInTheDocument();
    expect(screen.queryByText(/запазен[ои] мест|06/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Копирай поканата" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Копирай поканата" })).toHaveAttribute("autocomplete", "off");
  });

  it("offers an explicit invitation shortcut without scrolling or losing selected names", async () => {
    seed(); render(<FriendsClient />);
    const user = userEvent.setup();
    const shortcut = screen.getByRole("button", { name: "Към поканата" });
    expect(shortcut).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "Избери Мила" }));
    expect(shortcut).toBeEnabled();
    expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
    await user.type(screen.getByRole("searchbox"), "няма такова име");
    expect(shortcut).toBeEnabled();
    shortcut.focus();
    await user.keyboard("{Enter}");
    const heading = screen.getByRole("heading", { name: "Покана" });
    expect(heading).toHaveFocus();
    expect(shortcut).toHaveAttribute("aria-controls", heading.id);
    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: "start", behavior: "instant" });
    await user.tab();
    expect(screen.getByRole("radio", { name: "Към стая" })).toHaveFocus();
    await user.click(screen.getByRole("radio", { name: "Към сайта" }));
    expect((screen.getByRole("textbox", { name: "Текст на поканата" }) as HTMLTextAreaElement).value).toContain("Мила,");
    expect(saved()).toEqual([mila, boris]);
  });

  it.each(["close", "native cancel (Escape)", "backdrop"])("keeps a dismissed add draft and returns focus after %s", async (dismiss) => {
    render(<FriendsClient />);
    const user = userEvent.setup();
    await user.click(addTrigger());
    const dialog = screen.getByRole("dialog", { name: "Ново име" });
    expect(dialog).toHaveAttribute("open");
    expect(screen.getByRole("textbox", { name: "Име" })).toHaveFocus();
    fillName("Анна");
    fireEvent.change(screen.getByLabelText(/Бележка/), { target: { value: "Незапазена бележка" } });
    if (dismiss === "close") closeForm();
    // JSDOM has no native Escape default action; exercise the browser's cancel event.
    if (dismiss === "native cancel (Escape)") fireEvent(dialog, new Event("cancel", { cancelable: true }));
    if (dismiss === "backdrop") fireEvent.click(dialog, { clientX: -1, clientY: -1 });
    expect(dialog).not.toHaveAttribute("open");
    expect(addTrigger()).toHaveFocus();
    expect(localStorage.getItem(FRIENDS_STORAGE_KEY)).toBeNull();
    await user.click(addTrigger());
    expect(screen.getByRole("textbox", { name: "Име" })).toHaveValue("Анна");
    expect(screen.getByLabelText(/Бележка/)).toHaveValue("Незапазена бележка");
    expect(screen.getByRole("textbox", { name: "Име" })).toHaveFocus();
    fireEvent.click(screen.getByRole("dialog"), { clientX: 0, clientY: 0 });
    expect(screen.getByRole("dialog")).toHaveAttribute("open");
  });

  it("resumes an edit draft from either trigger without rewriting storage", async () => {
    seed(); render(<FriendsClient />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Редактирай Мила" }));
    fillName("Милена");
    fireEvent.change(screen.getByLabelText(/Бележка/), { target: { value: "Лична чернова" } });
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(screen.getByRole("button", { name: "Редактирай Мила" })).toHaveFocus();
    openAdd();
    expect(screen.getByRole("dialog", { name: "Редактирай запис" })).toHaveAttribute("open");
    expect(screen.getByRole("textbox", { name: "Име" })).toHaveValue("Милена");
    expect(screen.getByLabelText(/Бележка/)).toHaveValue("Лична чернова");
    closeForm();
    expect(addTrigger()).toHaveFocus();
    edit("Мила");
    expect(screen.getByRole("textbox", { name: "Име" })).toHaveValue("Милена");
    expect(screen.getByLabelText(/Бележка/)).toHaveValue("Лична чернова");
    expect(saved()).toEqual([mila, boris]);
  });

  it.each(["add", "edit", "recovery", "full", "conflict"])("wraps Tab and Shift+Tab inside the %s dialog", async (mode) => {
    if (mode === "recovery") localStorage.setItem(FRIENDS_STORAGE_KEY, "[null]");
    else if (mode === "full") seed(Array.from({ length: MAX_FRIENDS }, (_, index) => ({ id: `fixture-${index}`, name: `Име ${index}`, note: "" })));
    else seed();
    render(<FriendsClient />);
    const user = userEvent.setup();
    if (mode === "edit" || mode === "conflict") edit("Мила");
    else openAdd();
    if (mode === "conflict") {
      seed([{ ...mila, note: "Друга версия" }, boris]); notifyStorage();
    }
    const dialog = screen.getByRole("dialog");
    const close = within(dialog).getByRole("button", { name: "Затвори" });
    const last = mode === "edit" || mode === "conflict"
      ? within(dialog).getByRole("button", { name: "Откажи редакцията" })
      : mode === "add" ? within(dialog).getByRole("button", { name: "Добави име" })
      : screen.getByLabelText(/Бележка/);
    close.focus();
    await user.tab({ shift: true });
    expect(last).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(close).not.toHaveFocus();
    screen.getByRole("textbox", { name: "Име" }).focus();
    await user.tab();
    expect(screen.getByLabelText(/Бележка/)).toHaveFocus();
    if (mode === "recovery") {
      await user.click(screen.getByRole("button", { name: "Възстанови с резервно копие" }));
      close.focus();
      await user.tab({ shift: true });
      expect(within(dialog).getByRole("button", { name: "Добави име" })).toHaveFocus();
      await user.tab();
      expect(close).toHaveFocus();
    }
  });

  it("releases native modality while Activity is hidden and restores the draft on return", () => {
    const view = render(<Activity mode="visible"><FriendsClient /></Activity>);
    openAdd(); fillName("Анна");
    const dialog = screen.getByRole("dialog");
    view.rerender(<Activity mode="hidden"><FriendsClient /></Activity>);
    expect(dialog).not.toHaveAttribute("open");
    view.rerender(<Activity mode="visible"><FriendsClient /></Activity>);
    expect(screen.getByRole("dialog")).toHaveAttribute("open");
    expect(screen.getByRole("textbox", { name: "Име" })).toHaveValue("Анна");
    expect(screen.getByRole("textbox", { name: "Име" })).toHaveFocus();
    fireEvent(dialog, new Event("close"));
    expect(dialog).toHaveAttribute("open");
    expect(screen.getByRole("textbox", { name: "Име" })).toHaveValue("Анна");
    view.unmount();
    expect(dialog).not.toHaveAttribute("open");
  });

  it("returns focus to Add if the original edit trigger no longer exists", () => {
    seed(); render(<FriendsClient />);
    edit("Мила");
    fillName("Милена");
    seed([boris]); notifyStorage();
    expect(within(screen.getByRole("dialog")).getByRole("alert")).toHaveTextContent("Записът е премахнат");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    closeForm();
    expect(addTrigger()).toHaveFocus();
    openAdd();
    expect(screen.getByRole("textbox", { name: "Име" })).toHaveValue("Милена");
    expect(screen.getByRole("button", { name: "Запази промените" })).toBeDisabled();
  });

  it("shows decorative initials without turning local entries into profiles", () => {
    seed([{ ...mila, name: " мила " }, boris]); render(<FriendsClient />);
    const row = screen.getByRole("heading", { name: "мила" }).closest("li")!;
    const monogram = within(row).getByText("М", { exact: true });
    expect(monogram).toHaveAttribute("aria-hidden", "true");
    expect(monogram.previousElementSibling).toContainElement(within(row).getByRole("checkbox"));
    expect(monogram.previousElementSibling?.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(monogram.nextElementSibling).toContainElement(within(row).getByRole("heading"));
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("adds via the keyboard and restores legacy records without rewriting on mount", async () => {
    seed();
    const write = vi.spyOn(safeLocalStorage, "setJson");
    render(<FriendsClient />);
    expect(screen.getByRole("heading", { name: "Мила" })).toBeInTheDocument();
    expect(write).not.toHaveBeenCalled();
    const user = userEvent.setup();
    await user.click(addTrigger());
    await user.type(screen.getByRole("textbox", { name: "Име" }), "Анна{Enter}");
    expect(saved()).toHaveLength(3);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(addTrigger()).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("Името е добавено");
    openAdd();
    expect(screen.getByRole("textbox", { name: "Име" })).toHaveValue("");
    expect(screen.getByLabelText(/Бележка/)).toHaveValue("");
  });

  it("edits name and note in place, preserving identity and selection", async () => {
    seed();
    render(<FriendsClient />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Избери Мила" }));
    fireEvent.click(screen.getByRole("button", { name: "Редактирай Мила" }));
    expect(screen.getByRole("textbox", { name: "Име" })).toHaveFocus();
    fillName("Милена");
    fireEvent.change(screen.getByLabelText(/Бележка/), { target: { value: "Нова бележка" } });
    fireEvent.click(screen.getByRole("button", { name: "Запази промените" }));
    expect(saved()[0]).toEqual({ ...mila, name: "Милена", note: "Нова бележка" });
    expect(screen.getByRole("checkbox", { name: "Избери Милена" })).toBeChecked();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Редактирай Милена" })).toHaveFocus();
  });

  it("rejects duplicates, including during editing, without discarding the draft", () => {
    seed(); render(<FriendsClient />);
    openAdd();
    fillName(" МИЛА "); add();
    expect(within(screen.getByRole("dialog")).getByRole("alert")).toHaveTextContent("вече е в гостовата книга");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(saved()).toHaveLength(2);
    edit("Борис");
    fireEvent.click(screen.getByRole("button", { name: "Изхвърли черновата" }));
    fillName("Мила"); fireEvent.click(screen.getByRole("button", { name: "Запази промените" }));
    expect(saved()[1]).toEqual(boris);
    expect(screen.getByRole("textbox", { name: "Име" })).toHaveValue("Мила");
  });

  it("retains add and edit drafts on quota failure, then saves on retry", () => {
    seed(); render(<FriendsClient />);
    const write = vi.spyOn(safeLocalStorage, "setJson").mockReturnValue(false);
    openAdd();
    fillName("Анна"); add();
    expect(within(screen.getByRole("dialog")).getByRole("alert")).toHaveTextContent("не успя да запази");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Име" })).toHaveValue("Анна");
    expect(saved()).toHaveLength(2);
    edit("Мила");
    fireEvent.click(screen.getByRole("button", { name: "Изхвърли черновата" }));
    fillName("Милена"); fireEvent.click(screen.getByRole("button", { name: "Запази промените" }));
    expect(saved()[0]).toEqual(mila);
    expect(screen.getByRole("textbox", { name: "Име" })).toHaveValue("Милена");
    write.mockRestore();
    fireEvent.click(screen.getByRole("button", { name: "Запази промените" }));
    expect(saved()[0].name).toBe("Милена");
  });

  it("removes and undoes with the original order, note and selection, including failed writes", () => {
    seed(); render(<FriendsClient />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Избери Мила" }));
    const write = vi.spyOn(safeLocalStorage, "setJson").mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: "Премахни Мила" }));
    expect(screen.getByRole("heading", { name: "Мила" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Върни записа" })).not.toBeInTheDocument();
    write.mockRestore();
    fireEvent.click(screen.getByRole("button", { name: "Премахни Мила" }));
    expect(saved()).toEqual([boris]);
    const undoWrite = vi.spyOn(safeLocalStorage, "setJson").mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: "Върни записа" }));
    expect(saved()).toEqual([boris]);
    expect(screen.getByRole("button", { name: "Върни записа" })).toBeInTheDocument();
    undoWrite.mockRestore(); fireEvent.click(screen.getByRole("button", { name: "Върни записа" }));
    expect(saved()).toEqual([mila, boris]);
    expect(screen.getByRole("checkbox", { name: "Избери Мила" })).toBeChecked();
    expect(addTrigger()).toHaveFocus();
  });

  it("filters names and notes, selects only visible results, and preserves hidden selections", async () => {
    seed(); render(<FriendsClient />);
    const user = userEvent.setup();
    await user.type(screen.getByRole("searchbox"), "РАЗКАЗВАЧ");
    expect(screen.getByText("1 име", { exact: true })).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Избери видимите" }));
    await user.clear(screen.getByRole("searchbox"));
    expect(screen.getByRole("checkbox", { name: "Избери Мила" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Избери Борис" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Избери видимите" })).toBePartiallyChecked();
    await user.type(screen.getByRole("searchbox"), "няма такъв");
    expect(screen.getByRole("heading", { name: "Няма съвпадения" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Изчисти търсенето" }));
    expect(screen.getByRole("checkbox", { name: "Избери Мила" })).toBeChecked();
  });

  it("bounds a full book while allowing edit and removal", () => {
    seed(Array.from({ length: MAX_FRIENDS }, (_, index) => ({ id: `fixture-${index}`, name: `Име ${index}`, note: "" })));
    render(<FriendsClient />);
    openAdd();
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Добави име" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Име" })).toHaveAttribute("maxlength", "60");
    expect(screen.getByLabelText(/Бележка/)).toHaveAttribute("maxlength", "240");
    edit("Име 0");
    expect(screen.getByRole("button", { name: "Запази промените" })).toBeEnabled();
  });

  it.each(["[null]", "{broken", JSON.stringify([null, mila])])("keeps malformed %s untouched until explicit backed-up recovery", (raw) => {
    localStorage.setItem(FRIENDS_STORAGE_KEY, raw); render(<FriendsClient />);
    expect(screen.getByRole("alert")).toHaveTextContent("Оригиналът е непроменен");
    openAdd();
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByRole("alert")).toHaveTextContent("Оригиналът е непроменен");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(dialog.getByRole("button", { name: "Добави име" })).toBeDisabled();
    expect(localStorage.getItem(FRIENDS_STORAGE_KEY)).toBe(raw);
    fireEvent.click(screen.getByRole("button", { name: "Възстанови с резервно копие" }));
    expect(localStorage.getItem(FRIENDS_BACKUP_KEY)).toBe(raw);
    expect(dialog.getByRole("button", { name: "Добави име" })).toBeEnabled();
  });

  it("detects concurrent writes and keeps the draft instead of overwriting the other tab", () => {
    seed([mila]); render(<FriendsClient />); openAdd(); fillName("Анна"); seed(); add();
    expect(screen.getByRole("alert")).toHaveTextContent("друг раздел");
    expect(saved()).toEqual([mila, boris]);
    expect(screen.getByRole("textbox", { name: "Име" })).toHaveValue("Анна");
    add(); expect(saved()).toHaveLength(3);
  });

  it.each(["visible", "Activity-hidden", "before-storage-event"])("keeps the original edit baseline when the record changes %s", async (timing) => {
    seed();
    const view = render(<Activity mode="visible"><FriendsClient /></Activity>);
    fireEvent.click(screen.getByRole("button", { name: "Редактирай Мила" }));
    fillName("Милена");
    if (timing === "Activity-hidden") {
      view.rerender(<Activity mode="hidden"><FriendsClient /></Activity>);
    }
    const changed = { ...mila, note: "Запазена от друг раздел" };
    seed([changed, boris]);
    if (timing === "visible") notifyStorage();
    if (timing === "Activity-hidden") {
      view.rerender(<Activity mode="visible"><FriendsClient /></Activity>);
    }
    if (timing === "before-storage-event") {
      fireEvent.click(screen.getByRole("button", { name: "Запази промените" }));
    }
    const conflict = await screen.findByRole("region", { name: "Конфликт при редакция" });
    expect(conflict).toHaveTextContent(changed.note);
    expect(screen.getByRole("textbox", { name: "Име" })).toHaveValue("Милена");
    expect(screen.getByLabelText(/Бележка/)).toHaveValue(mila.note);
    expect(screen.getByRole("button", { name: "Запази промените" })).toBeDisabled();
    fireEvent.submit(screen.getByRole("form", { name: "Редактирай запис" }));
    expect(saved()).toEqual([changed, boris]);

    fireEvent.click(within(conflict).getByRole("button", { name: "Продължи с черновата" }));
    expect(saved()).toEqual([changed, boris]);
    expect(screen.getByRole("button", { name: "Запази промените" })).toBeEnabled();
    fireEvent.change(screen.getByLabelText(/Бележка/), { target: { value: `${changed.note}; моя добавка` } });
    fireEvent.click(screen.getByRole("button", { name: "Запази промените" }));
    expect(saved()[0]).toEqual({ ...mila, name: "Милена", note: `${changed.note}; моя добавка` });
  });

  it("requires a new conflict decision for changes after acknowledgement and can load the saved record", () => {
    seed(); render(<FriendsClient />);
    fireEvent.click(screen.getByRole("button", { name: "Редактирай Мила" }));
    fillName("Милена");
    seed([{ ...mila, note: "Първа промяна" }, boris]); notifyStorage();
    fireEvent.click(screen.getByRole("button", { name: "Продължи с черновата" }));
    const changed = { ...mila, note: "Втора промяна" };
    seed([changed, boris]); notifyStorage();
    expect(screen.getByRole("button", { name: "Запази промените" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Използвай запазения запис" }));
    expect(screen.getByRole("textbox", { name: "Име" })).toHaveValue(mila.name);
    expect(screen.getByLabelText(/Бележка/)).toHaveValue(changed.note);
    expect(screen.queryByRole("region", { name: "Конфликт при редакция" })).not.toBeInTheDocument();
    expect(saved()).toEqual([changed, boris]);
  });

  it("does not conflict on unrelated changes and retains a deleted record's draft for adding anew", () => {
    seed(); render(<FriendsClient />);
    fireEvent.click(screen.getByRole("button", { name: "Редактирай Мила" })); fillName("Милена");
    const changedBoris = { ...boris, note: "Промяна за Борис" };
    seed([mila, changedBoris]); notifyStorage();
    expect(screen.queryByRole("region", { name: "Конфликт при редакция" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Запази промените" }));
    expect(saved()[1]).toEqual(changedBoris);
    fireEvent.click(screen.getByRole("button", { name: "Редактирай Милена" }));
    seed([changedBoris]); notifyStorage();
    expect(screen.getByRole("region", { name: "Конфликт при редакция" })).toHaveTextContent("Записът е премахнат");
    fireEvent.click(screen.getByRole("button", { name: "Добави като ново име" }));
    expect(screen.getByRole("textbox", { name: "Име" })).toHaveValue("Милена");
    expect(saved()).toEqual([changedBoris]);
    add();
    expect(saved()[0]).toMatchObject({ name: "Милена", note: mila.note });
    expect(saved()[0].id).not.toBe(mila.id);
  });

  it("protects add and edit drafts when switching targets, including a repeated edit click", () => {
    seed(); render(<FriendsClient />);
    openAdd();
    fillName("Анна");
    fireEvent.change(screen.getByLabelText(/Бележка/), { target: { value: "Незапазена бележка" } });
    edit("Мила");
    expect(screen.getByRole("region", { name: "Незапазена чернова" })).toHaveTextContent("Мила");
    expect(screen.getByRole("button", { name: "Остани в черновата" })).toHaveFocus();
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Добави име" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Остани в черновата" }));
    expect(screen.getByRole("textbox", { name: "Име" })).toHaveValue("Анна");
    expect(screen.getByLabelText(/Бележка/)).toHaveValue("Незапазена бележка");
    expect(screen.getByRole("textbox", { name: "Име" })).toHaveFocus();
    edit("Мила");
    fireEvent.click(screen.getByRole("button", { name: "Изхвърли черновата" }));
    fillName("Милена");
    edit("Мила");
    expect(screen.queryByRole("region", { name: "Незапазена чернова" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Име" })).toHaveValue("Милена");
    edit("Борис");
    expect(screen.getByRole("textbox", { name: "Име" })).toHaveValue("Милена");
    fireEvent.click(screen.getByRole("button", { name: "Изхвърли черновата" }));
    expect(screen.getByRole("textbox", { name: "Име" })).toHaveValue(boris.name);
    expect(screen.getByLabelText(/Бележка/)).toHaveValue(boris.note);
    fireEvent.click(screen.getByRole("button", { name: "Откажи редакцията" }));
    expect(screen.getByRole("textbox", { name: "Име" })).toHaveValue("");
    expect(screen.getByLabelText(/Бележка/)).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Име" })).toHaveFocus();
    expect(saved()).toEqual([mila, boris]);
  });

  it("does not open an outdated record when the pending edit target changes or disappears", () => {
    seed(); render(<FriendsClient />); openAdd(); fillName("Анна");
    edit("Мила");
    seed([{ ...mila, note: "Последна версия" }, boris]); notifyStorage();
    fireEvent.click(screen.getByRole("button", { name: "Изхвърли черновата" }));
    expect(screen.getByLabelText(/Бележка/)).toHaveValue("Последна версия");
    fillName("Милена");
    edit("Борис");
    seed([mila]); notifyStorage();
    expect(screen.getByRole("region", { name: "Незапазена чернова" })).toHaveTextContent("вече е премахнат");
    expect(screen.queryByRole("button", { name: "Изхвърли черновата" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Остани в черновата" }));
    expect(screen.getByRole("textbox", { name: "Име" })).toHaveValue("Милена");
  });

  it.each(["storage-event", "before-storage-event", "Activity-hidden"])("preserves Undo across an unrelated %s change", (timing) => {
    seed();
    const view = render(<Activity mode="visible"><FriendsClient /></Activity>);
    fireEvent.click(screen.getByRole("checkbox", { name: "Избери Мила" }));
    fireEvent.click(screen.getByRole("button", { name: "Премахни Мила" }));
    if (timing === "Activity-hidden") view.rerender(<Activity mode="hidden"><FriendsClient /></Activity>);
    const rada = { id: "synthetic-rada", name: "Рада", note: "Друга бележка" };
    seed([boris, rada]);
    if (timing === "storage-event") notifyStorage();
    if (timing === "Activity-hidden") view.rerender(<Activity mode="visible"><FriendsClient /></Activity>);
    fireEvent.click(screen.getByRole("button", { name: "Върни записа" }));
    if (timing === "before-storage-event") {
      expect(saved()).toEqual([boris, rada]);
      fireEvent.click(screen.getByRole("button", { name: "Върни записа" }));
    }
    expect(saved()).toEqual([mila, boris, rada]);
    expect(screen.getByRole("checkbox", { name: "Избери Мила" })).toBeChecked();
  });

  it("retains Undo while restoration has an ID or name conflict", () => {
    seed(); render(<FriendsClient />);
    fireEvent.click(screen.getByRole("button", { name: "Премахни Мила" }));
    const changed = { ...mila, note: "Не презаписвай" };
    seed([boris, changed]); notifyStorage();
    fireEvent.click(screen.getByRole("button", { name: "Върни записа" }));
    expect(saved()).toEqual([boris, changed]);
    expect(screen.getByRole("button", { name: "Върни записа" })).toBeInTheDocument();
    seed([boris]); notifyStorage();
    fireEvent.click(screen.getByRole("button", { name: "Върни записа" }));
    expect(saved()).toEqual([mila, boris]);
  });

  it("retains Undo when another tab fills the book and restores after space is freed", () => {
    seed(); render(<FriendsClient />);
    fireEvent.click(screen.getByRole("button", { name: "Премахни Мила" }));
    const fullBook = Array.from({ length: MAX_FRIENDS }, (_, index) => ({ id: `full-${index}`, name: `Познат ${index}`, note: "" }));
    seed(fullBook); notifyStorage();
    fireEvent.click(screen.getByRole("button", { name: "Върни записа" }));
    expect(saved()).toEqual(fullBook);
    expect(screen.getByRole("button", { name: "Върни записа" })).toBeInTheDocument();
    seed(fullBook.slice(1)); notifyStorage();
    fireEvent.click(screen.getByRole("button", { name: "Върни записа" }));
    expect(saved()).toEqual([mila, ...fullBook.slice(1)]);
  });

  it("uses canonical room parsing and invitation URLs, without notes or page query parameters", async () => {
    seed(); render(<FriendsClient />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Избери Мила" }));
    fireEvent.change(screen.getByLabelText("Код на стаята"), { target: { value: "https://example.test/lobby/abc234" } });
    expect(screen.getByLabelText("Код на стаята")).toHaveValue("ABC234");
    fireEvent.click(screen.getByRole("button", { name: "Копирай поканата" }));
    const invite = `Мила,\nела на масата в Сенките.\nКод: ABC234\n${window.location.origin}/lobby/ABC234`;
    await waitFor(() => expect(copyTextToClipboard).toHaveBeenCalledWith(invite));
    expect(screen.getByRole("textbox", { name: "Текст на поканата" })).toHaveValue(invite);
    expect(screen.getByRole("textbox", { name: "Текст на поканата" })).toHaveAttribute("readonly");
    expect(screen.getByRole("textbox", { name: "Текст на поканата" })).not.toHaveValue(expect.stringContaining(mila.note));
    fireEvent.click(screen.getByRole("radio", { name: "Към сайта" }));
    fireEvent.click(screen.getByRole("button", { name: "Копирай поканата" }));
    await waitFor(() => expect(copyTextToClipboard).toHaveBeenLastCalledWith(`Мила,\nела да играем в Сенките.\n${window.location.origin}`));
  });

  it("shows plain invitation text without inventing a room and disables copying until valid", () => {
    render(<FriendsClient />);
    expect(screen.getByText("Ела да играем в Сенките.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Текст на поканата" })).not.toBeInTheDocument();
    const copy = screen.getByRole("button", { name: "Копирай поканата" });
    expect(copy).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Код на стаята"), { target: { value: "ABC" } });
    expect(screen.getByLabelText("Код на стаята")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Ела да играем в Сенките.")).toBeInTheDocument();
    expect(copy).toBeDisabled();
    fireEvent.click(copy);
    expect(copyTextToClipboard).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Код на стаята"), { target: { value: "ABC234" } });
    expect(copy).toBeEnabled();
    expect(copy).toHaveClass("btn-primary");
    expect(screen.queryByText("Ела да играем в Сенките.")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Код на стаята"), { target: { value: "" } });
    expect(copy).toBeDisabled();
    expect(screen.getByText("Ела да играем в Сенките.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Текст на поканата" })).not.toBeInTheDocument();
  });

  it.each([false, true])("formats the full letter with selected recipients: %s", (selectRecipients) => {
    seed(); render(<FriendsClient />);
    if (selectRecipients) fireEvent.click(screen.getByRole("checkbox", { name: "Избери видимите" }));
    const prefix = selectRecipients ? "Мила, Борис,\n" : "";
    fireEvent.change(screen.getByLabelText("Код на стаята"), { target: { value: "ABC234" } });
    expect(screen.getByRole("textbox", { name: "Текст на поканата" })).toHaveValue(
      `${prefix}ела на масата в Сенките.\nКод: ABC234\n${window.location.origin}/lobby/ABC234`,
    );
    expect(screen.getByText(selectRecipients ? "За 2 избрани имена." : "Обща покана без имена.")).toHaveClass("sr-only");
    fireEvent.click(screen.getByRole("radio", { name: "Към сайта" }));
    expect(screen.getByRole("textbox", { name: "Текст на поканата" })).toHaveValue(
      `${prefix}ела да играем в Сенките.\n${window.location.origin}`,
    );
    expect(screen.getByText(selectRecipients ? "За 2 избрани имена. Без код за стая." : "Обща покана без имена. Без код за стая.")).toHaveClass("sr-only");
  });

  it("exposes a focused, selected fallback when copying fails, and clears stale success on changes", async () => {
    vi.mocked(copyTextToClipboard).mockRejectedValueOnce(new Error("denied"));
    render(<FriendsClient />);
    fireEvent.click(screen.getByRole("radio", { name: "Към сайта" }));
    fireEvent.click(screen.getByRole("button", { name: "Копирай поканата" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Текстът е маркиран");
    const text = screen.getByRole("textbox", { name: "Текст на поканата" }) as HTMLTextAreaElement;
    expect(text).toHaveFocus(); expect(text.selectionEnd).toBe(text.value.length);
    fireEvent.click(screen.getByRole("button", { name: "Копирай поканата" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Поканата е копирана");
    fireEvent.click(screen.getByRole("radio", { name: "Към стая" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("ignores a late clipboard result for an outdated invitation", async () => {
    let finish!: () => void;
    vi.mocked(copyTextToClipboard).mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    render(<FriendsClient />);
    fireEvent.click(screen.getByRole("radio", { name: "Към сайта" }));
    fireEvent.click(screen.getByRole("button", { name: "Копирай поканата" }));
    fireEvent.click(screen.getByRole("radio", { name: "Към стая" }));
    await act(async () => finish());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
