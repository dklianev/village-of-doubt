import { Activity, StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { ImageConfigContext } from "next/dist/shared/lib/image-config-context.shared-runtime";
import { imageConfigDefault } from "next/dist/shared/lib/image-config";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROLE_DEFINITIONS, getRolesForFamily, type GameFamily, type RoleCode } from "@werewolf/shared";
import { GameRolesPage } from "../game-roles-page";

const imageConfig = { ...imageConfigDefault, qualities: [75, 85] };

function renderCatalog(family: GameFamily, mode: "visible" | "hidden" = "visible") {
  const tree = (activityMode = mode) => (
    <StrictMode>
      <SearchParamsContext.Provider value={new URLSearchParams(window.location.search)}>
        <ImageConfigContext.Provider value={imageConfig}>
          <Activity mode={activityMode}>
            <GameRolesPage family={family} />
          </Activity>
        </ImageConfigContext.Provider>
      </SearchParamsContext.Provider>
    </StrictMode>
  );
  const view = render(tree());
  return { ...view, syncUrl: (activityMode?: "visible" | "hidden") => view.rerender(tree(activityMode)) };
}

function roleButton(container: HTMLElement, role: RoleCode) {
  return within(container.querySelector<HTMLElement>(`.role-${role}`)!).getByRole("button");
}

async function traverseHistory(direction: "back" | "forward", syncUrl: () => void) {
  await act(async () => {
    await new Promise<void>((resolve) => {
      window.addEventListener("popstate", () => resolve(), { once: true });
      window.history[direction]();
    });
  });
  syncUrl();
}

describe("role catalogue deep links", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/werewolf/roles");
  });

  it.each([
    ["werewolves", "/werewolf/roles", "seer"],
    ["mafia", "/mafia/roles", "commissioner"],
  ] as const)("opens the requested %s dossier without another history entry", async (family, path, role) => {
    window.history.replaceState(null, "", `${path}?role=${role}`);
    const push = vi.spyOn(window.history, "pushState");
    const replace = vi.spyOn(window.history, "replaceState");
    renderCatalog(family);

    const dialog = await screen.findByRole("dialog", { name: ROLE_DEFINITIONS[role].nameBg });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(document.body.style.overflow).toBe("hidden");
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it.each(["werewolves", "mafia"] as const)("ignores absent, malformed and foreign %s roles", (family) => {
    const foreignRole = family === "mafia" ? "seer" : "commissioner";
    const validRole = family === "mafia" ? "commissioner" : "seer";
    const path = family === "mafia" ? "/mafia/roles" : "/werewolf/roles";
    const view = renderCatalog(family);
    const invalidQueries = [
      "", "?role=", "?role=not_a_role", "?role=__proto__", "?role=constructor", "?role=toString",
      `?role=${foreignRole}`, `?role=${validRole.toUpperCase()}`, `?role=%20${validRole}`,
      `?role=${validRole}&role=${validRole}`, `?role=${validRole}&role=${foreignRole}`,
      `?role=&role=${validRole}`, `?role=${validRole}&role=`, "?role=%E0%A4%A",
    ];

    for (const query of invalidQueries) {
      window.history.replaceState(null, "", `${path}${query}`);
      view.syncUrl();
      expect(screen.queryByRole("dialog"), query).not.toBeInTheDocument();
      expect(view.container.querySelectorAll(".role-codex-card")).toHaveLength(getRolesForFamily(family).length);
    }
    expect(document.body.style.overflow).toBe("");
  });

  it.each(["close button", "backdrop", "Escape"])("closes a direct link with %s and restores catalogue focus", async (method) => {
    window.history.replaceState(null, "", "/mafia/roles?source=home&role=commissioner&source=card#catalogue");
    const length = window.history.length;
    const user = userEvent.setup();
    const view = renderCatalog("mafia");
    const dialog = await screen.findByRole("dialog");
    const push = vi.spyOn(window.history, "pushState");
    const replace = vi.spyOn(window.history, "replaceState");

    await user.tab({ shift: true });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    await user.tab();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    if (method === "Escape") {
      await user.keyboard("{Escape}");
    } else {
      const closeButtons = within(dialog).getAllByRole("button");
      await user.click(closeButtons[method === "backdrop" ? 0 : 1]!);
    }
    view.syncUrl();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.location.pathname + window.location.search + window.location.hash)
      .toBe("/mafia/roles?source=home&source=card#catalogue");
    expect(window.history.length).toBe(length);
    expect(push).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(document.body.style.overflow).toBe("");
    expect(roleButton(view.container, "commissioner")).toHaveFocus();

    await user.click(roleButton(view.container, "doctor"));
    expect(await screen.findByRole("dialog", { name: ROLE_DEFINITIONS.doctor.nameBg })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    view.syncUrl();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(roleButton(view.container, "doctor")).toHaveFocus();
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("keeps ordinary catalogue selection, filters and focus local", async () => {
    const user = userEvent.setup();
    const view = renderCatalog("werewolves");
    const push = vi.spyOn(window.history, "pushState");
    const replace = vi.spyOn(window.history, "replaceState");
    await user.type(screen.getByRole("textbox"), "seer");
    const card = roleButton(view.container, "seer");
    await user.click(card);
    expect(await screen.findByRole("dialog", { name: ROLE_DEFINITIONS.seer.nameBg })).toBeInTheDocument();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("seer");
    expect(card).toHaveFocus();
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("tracks client URL changes and browser Back/Forward without reopening a removed role", async () => {
    const view = renderCatalog("werewolves");
    window.history.pushState(null, "", "/werewolf/roles?role=seer");
    view.syncUrl();
    expect(await screen.findByRole("dialog", { name: ROLE_DEFINITIONS.seer.nameBg })).toBeInTheDocument();

    await traverseHistory("back", view.syncUrl);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
    await traverseHistory("forward", view.syncUrl);
    expect(await screen.findByRole("dialog", { name: ROLE_DEFINITIONS.seer.nameBg })).toBeInTheDocument();

    window.history.replaceState(null, "", "/werewolf/roles?role=hunter");
    view.syncUrl();
    expect(await screen.findByRole("dialog", { name: ROLE_DEFINITIONS.hunter.nameBg })).toBeInTheDocument();
    window.history.replaceState(null, "", "/werewolf/roles?role=commissioner");
    view.syncUrl();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("leaves Back pointing to the landing page after closing its deep link", async () => {
    window.history.replaceState(null, "", "/werewolf");
    window.history.pushState(null, "", "/werewolf/roles?role=seer");
    const length = window.history.length;
    const user = userEvent.setup();
    const view = renderCatalog("werewolves");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    view.syncUrl();
    expect(window.history.length).toBe(length);

    await traverseHistory("back", view.syncUrl);
    expect(window.location.pathname).toBe("/werewolf");
    await traverseHistory("forward", view.syncUrl);
    expect(window.location.pathname + window.location.search).toBe("/werewolf/roles");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("uses the current URL when a cached catalogue becomes visible again", async () => {
    window.history.replaceState(null, "", "/werewolf/roles?role=seer");
    const view = renderCatalog("werewolves");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    view.syncUrl("hidden");
    expect(document.body.style.overflow).toBe("");
    window.history.replaceState(null, "", "/werewolf/roles");
    view.syncUrl("visible");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });

  it("prerenders the catalogue while URL data is suspended", () => {
    const searchParams = new URLSearchParams();
    const pending = new Promise<never>(() => {});
    vi.spyOn(searchParams, Symbol.iterator).mockImplementation(() => { throw pending; });
    const html = renderToString(
      <SearchParamsContext.Provider value={searchParams}>
        <ImageConfigContext.Provider value={imageConfig}>
          <GameRolesPage family="werewolves" />
        </ImageConfigContext.Provider>
      </SearchParamsContext.Provider>,
    );
    const document = new DOMParser().parseFromString(html, "text/html");

    expect(document.querySelector("main")).not.toBeNull();
    expect(document.querySelectorAll(".role-codex-card")).toHaveLength(getRolesForFamily("werewolves").length);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("returns focus to search when preserved filters hide the linked card", async () => {
    const user = userEvent.setup();
    const view = renderCatalog("werewolves");
    await act(async () => {
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "hunter" } });
    });
    expect(view.container.querySelector(".role-seer")).not.toBeInTheDocument();
    window.history.pushState(null, "", "/werewolf/roles?role=seer");
    await act(async () => { view.syncUrl(); });
    expect(await screen.findByRole("dialog", { name: ROLE_DEFINITIONS.seer.nameBg })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await act(async () => { view.syncUrl(); });

    expect(screen.getByRole("textbox")).toHaveValue("hunter");
    expect(screen.getByRole("textbox")).toHaveFocus();
  });
});
