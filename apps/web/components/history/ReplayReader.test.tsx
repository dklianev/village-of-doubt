import { fireEvent, render, screen } from "@testing-library/react";
import { Activity } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReplayReader } from "./ReplayReader";

const originalScroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
const scrollIntoView = vi.fn();

beforeEach(() => {
  window.history.replaceState(null, "", "/history/fixture/replay");
  scrollIntoView.mockClear();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView });
});

afterEach(() => {
  window.history.replaceState(null, "", "/history/fixture/replay");
  if (originalScroll) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", originalScroll);
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
});

function replayDocument(landmarks = false, defaultChapter = "chapter-1") {
  return <ReplayReader defaultChapter={defaultChapter}>
    <nav data-replay-nav><ol>
      <li><a href="#chapter-1">First chapter</a></li>
      <li><a href="#chapter-2">Second chapter</a></li>
      <li><a href="#phase-2">Final phase</a></li>
    </ol></nav>
    <section id="chapter-1" data-replay-chapter tabIndex={-1}>First events</section>
    <section id="chapter-2" data-replay-chapter tabIndex={-1} style={{ scrollMarginTop: 100 }}>
      <section id="phase-2" data-replay-phase tabIndex={-1}>Last events</section>
    </section>
    {landmarks && <>
      <a href="#replay-participants">Roster</a>
      <a href="#chronicle">Chronicle</a>
      <div id="chronicle" data-replay-landmark tabIndex={-1}>Chronicle heading</div>
      <aside id="replay-participants" data-replay-landmark tabIndex={-1}>Participants</aside>
    </>}
  </ReplayReader>;
}

function reader(landmarks = false) {
  return render(replayDocument(landmarks));
}

describe("replay reading position", () => {
  it.each(["Roster", "Chronicle"])("retains the selected chapter at %s after a cached route returns", (landmark) => {
    const document = replayDocument(true);
    const view = render(<Activity mode="visible">{document}</Activity>);
    fireEvent.click(screen.getByRole("link", { name: "Second chapter" }));
    fireEvent.click(screen.getByRole("link", { name: landmark }));
    view.rerender(<Activity mode="hidden">{document}</Activity>);
    view.rerender(<Activity mode="visible">{document}</Activity>);
    expect(screen.getByText("Last events")).toBeVisible();
    expect(screen.getByText("First events")).not.toBeVisible();
    expect(screen.getByRole("link", { name: "Second chapter" })).toHaveAttribute("aria-current", "location");
  });

  it.each(["chronicle", "replay-participants"])("initializes the default chapter before focusing a direct #%s", (target) => {
    window.history.replaceState(null, "", `/history/fixture/replay#${target}`);
    const push = vi.spyOn(window.history, "pushState");
    reader(true);

    expect(document.querySelectorAll("[data-replay-chapter]:not([hidden])")).toHaveLength(1);
    expect(document.getElementById("chapter-1")).toBeVisible();
    expect(screen.getByRole("link", { name: "First chapter" })).toHaveAttribute("aria-current", "location");
    expect(document.getElementById(target)).toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: "start", behavior: "instant" });
    expect(push).not.toHaveBeenCalled();
  });

  it.each(["chapter-1", "chapter-2"])("initializes a replaced document at a landmark using its default %s", (defaultChapter) => {
    const view = reader(true);
    fireEvent.click(screen.getByRole("link", { name: "Second chapter" }));
    fireEvent.click(screen.getByRole("link", { name: "Roster" }));

    view.rerender(replayDocument(true, defaultChapter));

    expect(document.querySelectorAll("[data-replay-chapter]:not([hidden])")).toHaveLength(1);
    expect(document.getElementById(defaultChapter)).toBeVisible();
    expect(document.querySelector(`[data-replay-nav] a[href="#${defaultChapter}"]`)).toHaveAttribute("aria-current", "location");
    expect(document.getElementById("replay-participants")).toHaveFocus();
  });

  it("moves to the roster and back without replacing the selected chapter", () => {
    reader(true);
    fireEvent.click(screen.getByRole("link", { name: "Second chapter" }));
    const chapter = document.getElementById("chapter-2")!;
    for (const [label, id] of [["Roster", "replay-participants"], ["Chronicle", "chronicle"]] as const) {
      fireEvent.click(screen.getByRole("link", { name: label }));
      expect(document.getElementById(id)).toHaveFocus();
      expect(window.location.hash).toBe(`#${id}`);
      expect(chapter).toBeVisible();
      expect(screen.getByRole("link", { name: "Second chapter" })).toHaveAttribute("aria-current", "location");
    }
  });

  it.each(["popstate", "hashchange"])("restores a roster landmark on %s without resetting the chapter", (event) => {
    reader(true);
    fireEvent.click(screen.getByRole("link", { name: "Second chapter" }));
    window.history.replaceState(null, "", "/history/fixture/replay#replay-participants");
    fireEvent(window, new Event(event));
    expect(document.getElementById("replay-participants")).toHaveFocus();
    expect(document.getElementById("chapter-2")).toBeVisible();
  });

  it.each([-800, 60, 760])("reveals a newly selected chapter whose heading is outside the reading area at %i px", (top) => {
    reader();
    const chapter = document.getElementById("chapter-2")!;
    vi.spyOn(chapter, "getBoundingClientRect").mockReturnValue(new DOMRect(0, top, 300, 1800));

    fireEvent.click(screen.getByRole("link", { name: "Second chapter" }));

    expect(chapter).toBeVisible();
    expect(chapter).toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: "start", behavior: "instant" });
    expect(window.location.hash).toBe("#chapter-2");
  });

  it("does not move the page when the newly selected chapter heading is already in view", () => {
    reader();
    const chapter = document.getElementById("chapter-2")!;
    vi.spyOn(chapter, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 200, 300, 1800));

    fireEvent.click(screen.getByRole("link", { name: "Second chapter" }));

    expect(chapter).toHaveFocus();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it.each(["chapter-2", "phase-2"])("reveals, focuses and scrolls to a direct #%s after unhiding it", (target) => {
    window.history.replaceState(null, "", `/history/fixture/replay#${target}`);
    const push = vi.spyOn(window.history, "pushState");
    reader();

    expect(document.getElementById("chapter-2")).toBeVisible();
    expect(document.getElementById(target)).toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: "start", behavior: "instant" });
    expect(push).not.toHaveBeenCalled();
  });

  it.each(["popstate", "hashchange"])("restores the reading destination on %s without adding history", (event) => {
    reader();
    window.history.replaceState(null, "", "/history/fixture/replay#phase-2");
    const push = vi.spyOn(window.history, "pushState");
    fireEvent(window, new Event(event));

    expect(document.getElementById("phase-2")).toBeVisible();
    expect(document.getElementById("phase-2")).toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: "start", behavior: "instant" });
    expect(push).not.toHaveBeenCalled();
  });

  it.each(["", "#missing", "#chronicle"])("keeps native page positioning when %s has no chapter destination", (hash) => {
    window.history.replaceState(null, "", `/history/fixture/replay${hash}`);
    reader();

    expect(document.getElementById("chapter-1")).toBeVisible();
    expect(document.getElementById("chapter-2")).not.toBeVisible();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
