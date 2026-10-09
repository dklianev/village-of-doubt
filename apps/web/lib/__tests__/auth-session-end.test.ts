import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { endAuthSession } from "../auth-session-end";
import { leaveAuthenticatedDocument, LOGOUT_REVISION_KEY } from "../auth-session-document";
import "./auth-session-end-styles";

const browserWindow = window;
const replace = vi.fn();

beforeEach(() => {
  replace.mockReset();
  browserWindow.localStorage.removeItem(LOGOUT_REVISION_KEY);
  vi.stubGlobal("window", new Proxy(browserWindow, {
    get(target, key) {
      if (key === "location") return { replace };
      return Reflect.get(target, key, target);
    },
  }));
});

afterEach(() => {
  document.getElementById("auth-session-ended")?.remove();
  document.querySelectorAll("[data-session-test]").forEach((node) => node.remove());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ending an authenticated document", () => {
  it("covers cached pages and body portals, releases native modality and focuses the home fallback", () => {
    const main = document.createElement("main");
    const portal = document.createElement("div");
    const oldDialog = document.createElement("dialog");
    for (const node of [main, portal, oldDialog]) {
      node.dataset.sessionTest = "true";
      node.textContent = "Synthetic private content";
      document.body.append(node);
    }
    oldDialog.showModal();
    leaveAuthenticatedDocument();
    expect(main).not.toBeVisible();
    expect(portal).not.toBeVisible();
    expect(oldDialog.open).toBe(false);
    const notice = document.getElementById("auth-session-ended") as HTMLDialogElement;
    expect(notice).toBeVisible();
    expect(notice.open).toBe(true);
    expect(notice.querySelector("a")).toHaveFocus();
    expect(notice.querySelector("a")).toHaveAttribute("href", "/");
    expect(replace).toHaveBeenCalledExactlyOnceWith("/");
    const cancel = new Event("cancel", { cancelable: true });
    notice.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    leaveAuthenticatedDocument();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll("#auth-session-ended")).toHaveLength(1);
  });

  it("changes the logout revision and announces session invalidation before replacing the document", () => {
    browserWindow.localStorage.setItem(LOGOUT_REVISION_KEY, "earlier");
    const listener = vi.fn();
    browserWindow.addEventListener("auth-session-change", listener);
    try {
      endAuthSession();
      expect(browserWindow.localStorage.getItem(LOGOUT_REVISION_KEY)).not.toBe("earlier");
      expect(listener).toHaveBeenCalledOnce();
      expect(replace).toHaveBeenCalledExactlyOnceWith("/");
    } finally {
      browserWindow.removeEventListener("auth-session-change", listener);
    }
  });

  it("ends the document when randomUUID is not available", () => {
    vi.stubGlobal("crypto", { getRandomValues: (words: Uint32Array) => words.fill(123) });
    endAuthSession();
    expect(browserWindow.localStorage.getItem(LOGOUT_REVISION_KEY)).toMatch(/^logout-/);
    expect(replace).toHaveBeenCalledExactlyOnceWith("/");
  });

  it("ends the document without either crypto capability", () => {
    vi.stubGlobal("crypto", undefined);
    endAuthSession();
    expect(browserWindow.localStorage.getItem(LOGOUT_REVISION_KEY)).toMatch(/^logout-/);
    expect(replace).toHaveBeenCalledExactlyOnceWith("/");
  });

  it("removes an outdated revision when storage is full", () => {
    browserWindow.localStorage.setItem(LOGOUT_REVISION_KEY, "earlier");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    endAuthSession();
    expect(browserWindow.localStorage.getItem(LOGOUT_REVISION_KEY)).toBeNull();
    expect(replace).toHaveBeenCalledExactlyOnceWith("/");
  });
});
