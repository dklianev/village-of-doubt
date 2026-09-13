import { StrictMode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImageConfigContext } from "next/dist/shared/lib/image-config-context.shared-runtime";
import { imageConfigDefault } from "next/dist/shared/lib/image-config";
import { expect, it } from "vitest";
import { RoleDossierTrigger } from "../RoleDossierTrigger";

it("gives only the latest activation ownership before portal effects run", async () => {
  const user = userEvent.setup();
  const { container } = render(
    <StrictMode>
      <ImageConfigContext.Provider value={{ ...imageConfigDefault, qualities: [75, 85] }}>
        <RoleDossierTrigger family="werewolves" role="seer">Seer</RoleDossierTrigger>
        <RoleDossierTrigger family="mafia" role="commissioner">Commissioner</RoleDossierTrigger>
      </ImageConfigContext.Provider>
    </StrictMode>,
  );
  const seer = screen.getByRole("button", { name: "Seer" });
  const commissioner = screen.getByRole("button", { name: "Commissioner" });
  await act(async () => {
    seer.click();
    commissioner.click();
  });
  await screen.findByRole("dialog");
  await waitFor(() => expect(document.querySelectorAll("[data-role-dossier]")).toHaveLength(1));
  expect(seer).toHaveAttribute("aria-expanded", "false");
  expect(commissioner).toHaveAttribute("aria-expanded", "true");
  await user.keyboard("{Escape}");
  expect(document.querySelector("[data-role-dossier]")).toBeNull();
  expect(container).not.toHaveAttribute("inert");
  expect(document.body.style.overflow).toBe("");
  expect(commissioner).toHaveFocus();
});
