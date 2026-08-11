import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LobbyWizard } from "../LobbyWizard";

const push = vi.fn();
let search = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => search,
}));

vi.mock("@/lib/sound", () => ({
  playCue: vi.fn(),
}));

describe("LobbyWizard", () => {
  beforeEach(() => {
    push.mockReset();
  });

  it("turns the neutral route into a focused family choice", () => {
    search = new URLSearchParams("visualAuth=1");
    render(<LobbyWizard />);

    expect(screen.getByRole("heading", { name: "Коя история започва тази вечер?" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Избери Върколак/ })).toHaveAttribute(
      "href",
      "/werewolf/create?visualAuth=1",
    );
    expect(screen.getByRole("link", { name: /Избери Мафия/ })).toHaveAttribute(
      "href",
      "/mafia/create?visualAuth=1",
    );
    expect(screen.queryByText("Роли")).not.toBeInTheDocument();
  });

  it("shows a ready-to-create werewolf evening without the legacy stepper", () => {
    search = new URLSearchParams();
    const { container } = render(<LobbyWizard family="werewolves" />);

    expect(screen.getByRole("heading", { name: "Подготви селото за една минута" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Първа нощ/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Класическо село/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Село с тайни/ })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Създай селото" })[0]).toBeEnabled();
    expect(screen.getByText("настройките са готови")).toBeInTheDocument();
    expect(screen.queryByText("Стъпка 1 / 4 · Стая")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Код")).not.toBeInTheDocument();
    expect(container.querySelector(".mobile-summary-chip")).not.toBeInTheDocument();
  });

  it("applies a werewolf experience and updates the recommended roster", async () => {
    search = new URLSearchParams();
    const user = userEvent.setup();
    render(<LobbyWizard family="werewolves" />);

    await user.click(screen.getByRole("button", { name: /Първа нощ/ }));

    expect(screen.getByRole("button", { name: /Първа нощ/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("6 играчи", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("Гадателка")).toBeInTheDocument();
  });

  it("switches the play context without exposing timer administration", async () => {
    search = new URLSearchParams();
    const user = userEvent.setup();
    render(<LobbyWizard family="werewolves" />);

    await user.click(screen.getByRole("button", { name: "На живо" }));

    expect(screen.getByRole("button", { name: "На живо" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Без чат")).toBeInTheDocument();
    expect(screen.queryByText("Ръчно темпо")).not.toBeInTheDocument();
  });

  it("keeps the play context label inside its visual control group", () => {
    search = new URLSearchParams();
    const { container } = render(<LobbyWizard family="werewolves" />);

    const contextGroup = screen.getByRole("group", { name: "Къде играете?" });
    expect(contextGroup.closest("section.create-context-panel")).not.toBeNull();
    expect(container.querySelector("fieldset.create-context-panel")).not.toBeInTheDocument();
  });

  it("creates a playable URL from the quick surface", async () => {
    search = new URLSearchParams();
    const user = userEvent.setup();
    render(<LobbyWizard family="werewolves" />);

    await user.click(screen.getAllByRole("button", { name: "Създай селото" })[0]!);

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(push).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\/play\/[A-Z0-9]{6}\?.*mode=werewolves_classic.*players=12.*lovers=1/,
      ),
    );
  });

  it("locks sport mafia to ten players while keeping the context choice", async () => {
    search = new URLSearchParams();
    const user = userEvent.setup();
    render(<LobbyWizard family="mafia" />);

    await user.click(screen.getByRole("button", { name: /Спортна маса/ }));

    expect(screen.getByRole("button", { name: /Спортна маса/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Точно 10 играчи")).toBeInTheDocument();
    expect(screen.queryByRole("slider", { name: "Брой играчи" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Отвори масата" })[0]).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Настрой детайлите" }));
    const dialog = screen.getByRole("dialog", { name: "Настрой детайлите" });
    await user.click(within(dialog).getByRole("tab", { name: "Правила и комуникация" }));
    await user.click(within(dialog).getByText("Покажи още настройки"));

    expect(within(dialog).getByText("Спортната маса е фиксирана за точно 10 играчи.")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Спортният формат изисква избор и не допуска пропускане на глас."),
    ).toBeInTheDocument();
  });

  it("opens an explicit mode directly instead of returning to the family choice", () => {
    search = new URLSearchParams("mode=mafia_sport");
    render(<LobbyWizard initialMode="mafia_sport" />);

    expect(screen.getByRole("heading", { name: "Отвори частна маса за една минута" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Спортна маса/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("heading", { name: "Коя история започва тази вечер?" })).not.toBeInTheDocument();
  });

  it("keeps expert settings in an accessible sheet and preserves their state", async () => {
    search = new URLSearchParams();
    const user = userEvent.setup();
    render(<LobbyWizard family="werewolves" />);

    await user.click(screen.getByRole("button", { name: "Настрой детайлите" }));
    const dialog = screen.getByRole("dialog", { name: "Настрой детайлите" });
    await user.click(within(dialog).getByRole("tab", { name: "Име и покана" }));
    const roomName = within(dialog).getByRole("textbox", { name: "Име на стаята" });
    await user.clear(roomName);
    await user.type(roomName, "Нощ край огъня");
    await user.click(within(dialog).getByRole("button", { name: "Затвори настройките" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Настрой детайлите" })).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Настрой детайлите" }));
    const reopened = screen.getByRole("dialog", { name: "Настрой детайлите" });
    await user.click(within(reopened).getByRole("tab", { name: "Име и покана" }));
    expect(within(reopened).getByRole("textbox", { name: "Име на стаята" })).toHaveValue("Нощ край огъня");
  });

  it("uses the workspace sheet and exposes explicit role gallery controls", async () => {
    search = new URLSearchParams();
    const user = userEvent.setup();
    render(<LobbyWizard family="werewolves" />);

    await user.click(screen.getByRole("button", { name: "Настрой детайлите" }));
    const dialog = screen.getByRole("dialog", { name: "Настрой детайлите" });
    const gallery = within(dialog).getByRole("region", { name: "Избор на роли" });

    expect(dialog).toHaveAttribute("data-size", "workspace");
    expect(gallery).toHaveAttribute("data-layout", "workspace");
    expect(within(dialog).getByRole("region", { name: "Състав на масата" })).toHaveAttribute("tabindex", "0");
    expect(within(dialog).getByRole("button", { name: "Предишни роли" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Следващи роли" })).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Настрой ръчно" }));
    expect(within(dialog).getByRole("button", { name: "Автоматични" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Ръчно водени" })).toBeInTheDocument();
  });

  it("keeps a full roster valid by swapping a reserve villager for a special role", async () => {
    search = new URLSearchParams();
    const user = userEvent.setup();
    render(<LobbyWizard family="werewolves" />);

    await user.click(screen.getByRole("button", { name: "Настрой детайлите" }));
    const dialog = screen.getByRole("dialog", { name: "Настрой детайлите" });
    await user.click(within(dialog).getByRole("button", { name: "Настрой ръчно" }));
    await user.click(within(dialog).getByRole("button", { name: "Добави Лечител" }));

    expect(within(dialog).getByRole("status")).toHaveTextContent("Лечител замени Селянин / Селянка");
    expect(within(dialog).getByText("12/12 роли", { exact: false })).toBeInTheDocument();
    expect(within(dialog).queryByText(/Броят роли \(13\)/)).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Премахни Лечител" }));
    expect(within(dialog).getByRole("status")).toHaveTextContent(
      "Лечител е премахнат. Селянин / Селянка запълни мястото.",
    );
    expect(within(dialog).getByText("12/12 роли", { exact: false })).toBeInTheDocument();
  });

  it("labels a customized roster as the host's own composition on the quick surface", async () => {
    search = new URLSearchParams();
    const user = userEvent.setup();
    render(<LobbyWizard family="werewolves" />);

    await user.click(screen.getByRole("button", { name: "Настрой детайлите" }));
    const dialog = screen.getByRole("dialog", { name: "Настрой детайлите" });
    await user.click(within(dialog).getByRole("button", { name: "Настрой ръчно" }));
    await user.click(within(dialog).getByRole("button", { name: "Добави Лечител" }));
    await user.click(within(dialog).getByRole("button", { name: "Готово" }));

    expect(screen.getByRole("heading", { name: "Твоят състав" })).toBeInTheDocument();
    expect(screen.getByText("Ръчният състав остава точен при промяна на броя играчи.")).toBeInTheDocument();
  });

  it("presents Cupid as a role and never as an independent Lovers switch", async () => {
    search = new URLSearchParams();
    const user = userEvent.setup();
    render(<LobbyWizard family="werewolves" />);

    await user.click(screen.getByRole("button", { name: "Настрой детайлите" }));

    expect(screen.getAllByText("Купидон").length).toBeGreaterThan(0);
    expect(screen.queryByText("Купидон и Влюбени")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Включено" })).not.toBeInTheDocument();
  });

  it("adds the Jester option to a werewolf evening", async () => {
    search = new URLSearchParams();
    const user = userEvent.setup();
    render(<LobbyWizard family="werewolves" />);

    await user.click(screen.getByRole("button", { name: "Настрой детайлите" }));
    const dialog = screen.getByRole("dialog", { name: "Настрой детайлите" });
    await user.click(within(dialog).getByRole("tab", { name: "Правила и комуникация" }));
    await user.click(within(dialog).getByText("Покажи още настройки"));
    await user.click(within(dialog).getByRole("checkbox", { name: "Добави Шут с лична победа" }));
    await user.click(within(dialog).getByRole("button", { name: "Готово" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Настрой детайлите" })).not.toBeInTheDocument(),
    );
    await user.click(screen.getAllByRole("button", { name: "Създай селото" })[0]!);

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(push).toHaveBeenCalledWith(expect.stringMatching(/[?&]jester=1(?:&|$)/));
  });
});
