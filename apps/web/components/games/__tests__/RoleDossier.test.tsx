import { Activity, StrictMode } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImageConfigContext } from "next/dist/shared/lib/image-config-context.shared-runtime";
import { imageConfigDefault } from "next/dist/shared/lib/image-config";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROLE_DEFINITIONS, getRoleRuntimeStatus, getRolesForFamily, teamLabelBg } from "@werewolf/shared";
import { RoleDossierTrigger } from "../RoleDossierTrigger";
import { RoleSpotlight } from "../RoleSpotlight";

const imageConfig = { ...imageConfigDefault, qualities: [75, 85] };

describe("local role dossiers", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/werewolf?source=home#roles");
  });

  it.each(
    (["werewolves", "mafia"] as const).flatMap((family) =>
      getRolesForFamily(family).map((role) => ({ family, role })),
    ),
  )("preserves semantic facts and canonical content for $family/$role", async ({ family, role }) => {
    const user = userEvent.setup();
    const definition = ROLE_DEFINITIONS[role];
    render(
      <ImageConfigContext.Provider value={imageConfig}>
        <RoleDossierTrigger family={family} role={role}>{definition.nameBg}</RoleDossierTrigger>
      </ImageConfigContext.Provider>,
    );
    await user.click(screen.getByRole("button", { name: definition.nameBg }));
    const dialog = await screen.findByRole("dialog", { name: definition.nameBg });
    const dossier = within(dialog);
    expect(dossier.getByRole("heading", { level: 2, name: definition.nameBg })).toBeVisible();
    expect(dossier.getByText(teamLabelBg(definition.team, family), { exact: true, selector: "p" })).toBeVisible();
    expect(dossier.getByText(definition.fullDescriptionBg, { exact: true })).toBeVisible();

    const facts = dossier.getByLabelText("Данни за ролята", { selector: "dl" });
    const terms = within(facts).getAllByRole("term");
    const values = within(facts).getAllByRole("definition");
    expect(terms.map((term) => term.textContent)).toEqual(["Стойност", "Нощен ред", "Играчи", "Копия"]);
    expect(values.map((value) => value.textContent)).toEqual([
      definition.value > 0 ? `+${definition.value}` : String(definition.value),
      definition.nightOrder === null ? "Без нощен ред" : String(definition.nightOrder),
      `${definition.minPlayers}+`,
      definition.maxCopies === 1 ? "1 копие" : `До ${definition.maxCopies} копия`,
    ]);
    for (const [index, term] of terms.entries()) {
      expect(term.tagName).toBe("DT");
      expect(values[index]!.tagName).toBe("DD");
      expect(term.nextElementSibling).toBe(values[index]);
      expect(term).toBeVisible();
      expect(values[index]).toBeVisible();
    }

    const playable = getRoleRuntimeStatus(role) === "playable";
    expect(dossier.getByText(playable ? "Работи в автоматична игра" : "За ръчно водене", { exact: true })).toBeVisible();
    expect(dossier.queryByText(playable ? "За ръчно водене" : "Работи в автоматична игра", { exact: true })).not.toBeInTheDocument();
    if (definition.isDefaultEnabled) {
      expect(dossier.getByText("Стартова игра", { exact: true })).toBeVisible();
    } else {
      expect(dossier.queryByText("Стартова игра", { exact: true })).not.toBeInTheDocument();
    }
    for (const tag of definition.tags) {
      expect(dossier.getByText(tag, { exact: true })).toBeVisible();
    }
    for (const dependency of definition.dependencies) {
      expect(dossier.getByText(dependency.reasonBg, { exact: true })).toBeVisible();
    }
  });

  it.each(["werewolves", "mafia"] as const)("opens %s spotlight portraits locally without navigating", async (family) => {
    const user = userEvent.setup();
    const { container } = render(
      <ImageConfigContext.Provider value={imageConfig}><RoleSpotlight family={family} /></ImageConfigContext.Provider>,
    );
    const role = family === "mafia" ? "commissioner" : "seer";
    const trigger = screen.getByRole("button", { name: new RegExp(`^${ROLE_DEFINITIONS[role].nameBg}`) });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger.querySelector(".role-spotlight__open")).toHaveAttribute("title", "Разгледай ролята");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const push = vi.spyOn(window.history, "pushState");
    const replace = vi.spyOn(window.history, "replaceState");
    await user.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: ROLE_DEFINITIONS[role].nameBg });
    expect(container).not.toContainElement(dialog);
    expect(dialog.parentElement).toBe(document.body);
    expect(dialog).toHaveAttribute("data-family", family);
    expect(dialog).toHaveAttribute("data-faction", family);
    expect(dialog.closest("[inert]")).toBeNull();
    expect(container).toHaveAttribute("inert");
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(dialog.querySelector(".role-codex-detail-close svg")).toHaveAttribute("aria-hidden", "true");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(container).not.toHaveAttribute("inert");
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(window.location.pathname + window.location.search + window.location.hash).toBe("/werewolf?source=home#roles");
  });

  it.each(["Escape", "backdrop", "close"])("restores background state, scroll and focus after %s", async (method) => {
    const user = userEvent.setup();
    const previouslyHidden = document.createElement("aside");
    previouslyHidden.setAttribute("inert", "");
    previouslyHidden.setAttribute("aria-hidden", "true");
    document.body.append(previouslyHidden);
    document.body.style.overflow = "scroll";
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const scrollY = Object.getOwnPropertyDescriptor(window, "scrollY")!;
    Object.defineProperty(window, "scrollY", { configurable: true, value: 880 });
    const { container } = render(
      <StrictMode>
        <ImageConfigContext.Provider value={imageConfig}>
          <RoleDossierTrigger family="mafia" role="commissioner" className="variant-trigger">Commissioner</RoleDossierTrigger>
        </ImageConfigContext.Provider>
      </StrictMode>,
    );
    try {
      const trigger = screen.getByRole("button", { name: "Commissioner" });
      await user.click(trigger);
      const dialog = await screen.findByRole("dialog");
      expect(trigger).toHaveAttribute("aria-expanded", "true");
      expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(container).toHaveAttribute("aria-hidden", "true");
      expect(document.body.style.overflow).toBe("hidden");
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
      await user.tab({ shift: true });
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
      Object.defineProperty(window, "scrollY", { configurable: true, value: 890 });
      if (method === "Escape") await user.keyboard("{Escape}");
      else await user.click(dialog.querySelector<HTMLButtonElement>(method === "backdrop" ? ".role-codex-detail-backdrop" : ".role-codex-detail-close")!);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(container).not.toHaveAttribute("inert");
      expect(container).not.toHaveAttribute("aria-hidden");
      expect(previouslyHidden).toHaveAttribute("inert");
      expect(previouslyHidden).toHaveAttribute("aria-hidden", "true");
      expect(document.body.style.overflow).toBe("scroll");
      expect(scrollTo).toHaveBeenLastCalledWith({ top: 880, left: 0, behavior: "instant" });
    } finally {
      previouslyHidden.remove();
      document.body.style.overflow = "";
      Object.defineProperty(window, "scrollY", scrollY);
    }
  });

  it("cleans up a dossier when its cached landing page is hidden", async () => {
    const user = userEvent.setup();
    const tree = (mode: "visible" | "hidden") => (
      <ImageConfigContext.Provider value={imageConfig}>
        <Activity mode={mode}><RoleDossierTrigger family="werewolves" role="seer">Seer</RoleDossierTrigger></Activity>
      </ImageConfigContext.Provider>
    );
    const view = render(tree("visible"));
    await user.click(screen.getByRole("button", { name: "Seer" }));
    await screen.findByRole("dialog");
    await act(async () => { view.rerender(tree("hidden")); });
    expect(document.body.style.overflow).toBe("");
    expect(view.container).not.toHaveAttribute("inert");
    await act(async () => { view.rerender(tree("visible")); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Seer" })).toHaveAttribute("aria-expanded", "false");
  });

  it("gives successive dossiers distinct labels without stale portal content", async () => {
    const user = userEvent.setup();
    render(
      <ImageConfigContext.Provider value={imageConfig}>
        <RoleDossierTrigger family="werewolves" role="seer">Seer</RoleDossierTrigger>
        <RoleDossierTrigger family="mafia" role="commissioner">Commissioner</RoleDossierTrigger>
      </ImageConfigContext.Provider>,
    );
    const ids: string[] = [];
    for (const name of ["Seer", "Commissioner"]) {
      await user.click(screen.getByRole("button", { name }));
      const dialog = await screen.findByRole("dialog");
      const id = dialog.getAttribute("aria-labelledby")!;
      ids.push(id);
      expect(document.querySelectorAll(`[id="${id}"]`)).toHaveLength(1);
      expect(dialog).toContainElement(document.getElementById(id));
      expect(within(dialog).getByRole("heading", { level: 2 })).toHaveAttribute("id", id);
      await user.keyboard("{Escape}");
      expect(document.getElementById(id)).toBeNull();
    }
    expect(new Set(ids).size).toBe(2);
  });

  it("rejects a role from the wrong family without locking the page", async () => {
    const user = userEvent.setup();
    const { container } = render(<RoleDossierTrigger family="mafia" role="seer">Wrong family</RoleDossierTrigger>);
    const trigger = screen.getByRole("button", { name: "Wrong family" });
    await user.click(trigger);
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(container).not.toHaveAttribute("inert");
    expect(document.body.style.overflow).toBe("");
  });
});
