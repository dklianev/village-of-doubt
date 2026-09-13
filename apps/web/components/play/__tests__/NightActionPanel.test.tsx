import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NightActionPanel } from "@/components/play/NightActionPanel";
import type { PublicPlayer } from "@/lib/play/types";

function player(overrides: Partial<PublicPlayer> = {}): PublicPlayer {
  return {
    userId: "u1",
    displayName: "Анна",
    connected: true,
    ready: true,
    playing: true,
    alive: true,
    host: false,
    narrator: false,
    acceptedFullNarrator: true,
    mayor: false,
    hasVoted: false,
    actedThisPhase: false,
    revealedRole: "",
    ...overrides,
  };
}

function renderPanel(overrides: Partial<Parameters<typeof NightActionPanel>[0]> = {}) {
  const players = [
    player({ userId: "u1", displayName: "Анна" }),
    player({ userId: "u2", displayName: "Борис" }),
    player({ userId: "u3", displayName: "Вяра", alive: false, revealedRole: "villager" }),
  ];
  const livingPlayers = players.filter((item) => item.alive);

  const props: Parameters<typeof NightActionPanel>[0] = {
    players,
    livingPlayers,
    currentUserId: "u1",
    doctorCanSelfProtect: false,
    phase: "night",
    privateRole: "werewolf",
    selectedTargetId: "",
    secondTargetId: "",
    onResetPrimaryTarget: vi.fn(),
    sendNightAction: vi.fn(),
    ...overrides,
  };

  render(<NightActionPanel {...props} />);
  return props;
}

describe("NightActionPanel", () => {
  it.each([
    ["werewolf", "Потвърди жертва", { kind: "faction_kill", targetUserId: "u2" }],
    ["doctor", "Пази тази нощ", { kind: "healer_protect", targetUserId: "u2" }],
    ["witch", "Лекувай", { kind: "witch_heal", targetUserId: "u2" }],
    ["blacksmith", "Изкови меч", { kind: "blacksmith_sword", targetUserId: "u1", receiverUserId: "u2" }],
    ["cupid", "Свържи Влюбените", { kind: "cupid_link", firstUserId: "u1", secondUserId: "u2" }],
  ] as const)("disarms skip when submitting a %s action without changing the selected targets", async (privateRole, label, action) => {
    const user = userEvent.setup();
    const needsTwoTargets = privateRole === "blacksmith" || privateRole === "cupid";
    const props = renderPanel({
      privateRole,
      phase: "first_night",
      selectedTargetId: needsTwoTargets ? "u1" : "u2",
      secondTargetId: needsTwoTargets ? "u2" : "",
    });

    await user.click(screen.getByRole("button", { name: "Пропусни" }));
    expect(screen.getByRole("button", { name: "Потвърди пропуска" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: label }));

    expect(props.sendNightAction).toHaveBeenCalledExactlyOnceWith(action);
    const skip = screen.getByRole("button", { name: "Пропусни" });
    expect(skip).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("group", { name: "Избрана цел" })).toHaveTextContent("Борис");
    expect(screen.queryByRole("group", { name: "Приети действия" })).not.toBeInTheDocument();

    await user.click(skip);
    expect(props.sendNightAction).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Потвърди пропуска" }));
    expect(props.sendNightAction).toHaveBeenLastCalledWith({ kind: "skip" });
  });

  it.each([
    ["witch", "Лекувай", "Отрови", "witch_heal", "witch_poison"],
    ["don", "Потвърди жертва", "Търси Комисаря", "faction_kill", "check_commissioner"],
    ["lawyer", "Потвърди жертва", "Подготви алиби", "faction_kill", "lawyer_cover"],
    ["informant", "Потвърди жертва", "Отвори досие", "faction_kill", "check_role"],
  ] as const)("keeps both %s action kinds available and explains that skip does not cancel them", async (privateRole, firstLabel, secondLabel, firstKind, secondKind) => {
    const props = renderPanel({ privateRole, selectedTargetId: "u2" });
    const user = userEvent.setup();
    expect(screen.getByText(/последното прието действие от всеки вид/u)).toBeInTheDocument();
    expect(screen.getByText(/не отменя вече приетите действия/u)).toBeInTheDocument();
    expect(screen.queryByText(/последното изпратено действие/u)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: firstLabel }));
    await user.click(screen.getByRole("button", { name: secondLabel }));
    await user.click(screen.getByRole("button", { name: "Пропусни" }));
    await user.click(screen.getByRole("button", { name: "Потвърди пропуска" }));
    expect(vi.mocked(props.sendNightAction).mock.calls).toEqual([
      [{ kind: firstKind, targetUserId: "u2" }],
      [{ kind: secondKind, targetUserId: "u2" }],
      [{ kind: "skip" }],
    ]);
    expect(screen.getByRole("group", { name: "Избрана цел" })).toHaveTextContent("Борис");
    expect(screen.queryByRole("group", { name: "Приети действия" })).not.toBeInTheDocument();
  });

  it("describes the latest accepted action for a single-action role", () => {
    renderPanel({ privateRole: "seer" });
    expect(screen.getByText(/последното прието действие\./u)).toBeInTheDocument();
    expect(screen.queryByText(/не отменя вече приетите действия/u)).not.toBeInTheDocument();
  });

  it.each([
    ["werewolf", "Потвърди жертва", "faction_kill"],
    ["vampire", "Потвърди жертва", "faction_kill"],
    ["commissioner", "Провери дали е от Мафията", "check_alignment"],
    ["detective", "Разследвай целта", "check_alignment"],
    ["informant", "Отвори досие", "check_role"],
    ["roleblocker", "Блокирай действие", "roleblock"],
    ["lawyer", "Подготви алиби", "lawyer_cover"],
    ["medium", "Свържи се с елиминиран", "medium_contact"],
    ["don", "Търси Комисаря", "check_commissioner"],
    ["seer", "Провери заплахата", "check_role"],
    ["oracle", "Провери заплахата", "check_role"],
    ["investigator", "Провери тройка", "investigator_check"],
    ["witch", "Лекувай", "witch_heal"],
    ["witch", "Отрови", "witch_poison"],
    ["healer", "Пази тази нощ", "healer_protect"],
    ["doctor", "Пази тази нощ", "healer_protect"],
    ["bodyguard", "Пази тази нощ", "healer_protect"],
    ["priest", "Дай благословия", "priest_bless"],
    ["stray_cat", "Избери дом", "stray_cat_choose"],
    ["thief", "Открадни карта", "thief_steal"],
  ] as const)("keeps %s command %s accessible with a real icon and unchanged payload", async (privateRole, label, kind) => {
    const props = renderPanel({ privateRole, phase: "first_night", selectedTargetId: privateRole === "medium" ? "u3" : "u2" });
    const command = screen.getByRole("button", { name: label });
    const icon = command.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(icon!.querySelector("path, circle, line, polyline, rect")).not.toBeNull();
    await userEvent.click(command);
    expect(props.sendNightAction).toHaveBeenCalledExactlyOnceWith({ kind, targetUserId: props.selectedTargetId });
  });

  it.each(["", "missing", "u1"])("cannot submit a missing or ineligible investigation target (%s)", async (selectedTargetId) => {
    const props = renderPanel({ privateRole: "seer", selectedTargetId });
    const command = screen.getByRole("button", { name: "Провери заплахата" });
    expect(command).toBeDisabled();
    await userEvent.click(command);
    expect(props.sendNightAction).not.toHaveBeenCalled();
  });

  it("submits the selected faction kill target for a werewolf", async () => {
    const user = userEvent.setup();
    const props = renderPanel({ selectedTargetId: "u2" });

    const selectedTarget = screen.getByRole("group", { name: "Избрана цел" });
    const actions = screen.getByRole("group", { name: "Действия за тази нощ" });
    const commandConsole = screen.getByRole("region", { name: "Нощен команден ритуал" });
    const confirmButton = screen.getByRole("button", { name: "Потвърди жертва" });
    const skipButton = screen.getByRole("button", { name: "Пропусни" });

    expect(selectedTarget).toHaveAttribute("data-selection-state", "ready");
    expect(commandConsole).toHaveAttribute("data-command-state", "ready");
    expect(selectedTarget).toContainElement(screen.getByText("Борис"));
    expect(actions).toContainElement(confirmButton);
    expect(actions).toContainElement(skipButton);
    expect(confirmButton).toHaveAttribute("data-command-priority", "primary");
    expect(skipButton).toHaveAttribute("data-command-priority", "quiet");

    await user.click(confirmButton);

    expect(props.sendNightAction).toHaveBeenCalledWith({
      kind: "faction_kill",
      targetUserId: "u2",
    });
  });

  it("disables medium contact when there are no eliminated players", () => {
    renderPanel({
      privateRole: "medium",
      players: [
        player({ userId: "u1", displayName: "Анна" }),
        player({ userId: "u2", displayName: "Борис" }),
      ],
      livingPlayers: [
        player({ userId: "u1", displayName: "Анна" }),
        player({ userId: "u2", displayName: "Борис" }),
      ],
    });

    expect(screen.getByText("Медиумът няма елиминиран играч, с когото да се свърже тази нощ.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Свържи се с елиминиран" })).toBeDisabled();
  });

  it("requires a second deliberate click before skipping a night action", async () => {
    const user = userEvent.setup();
    const props = renderPanel({ privateRole: "doctor" });

    await user.click(screen.getByRole("button", { name: "Пропусни" }));

    expect(props.sendNightAction).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Потвърди пропуска" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Потвърди пропуска" }));

    expect(props.sendNightAction).toHaveBeenCalledWith({ kind: "skip" });
  });

  it("does not offer doctor self-protect when the room option is not in the client snapshot", () => {
    renderPanel({ privateRole: "doctor", selectedTargetId: "u1" });

    expect(screen.getByRole("region", { name: "Нощен команден ритуал" })).toHaveAttribute("data-command-state", "awaiting-target");
    expect(screen.getByRole("group", { name: "Избрана цел" })).toHaveAttribute("data-selection-state", "empty");
    expect(screen.getByText("избери място")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Пази тази нощ" })).toBeDisabled();
  });

  it("offers doctor self-protect when the room option allows it", () => {
    renderPanel({ privateRole: "doctor", selectedTargetId: "u1", doctorCanSelfProtect: true });

    expect(screen.getByText("Анна")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Пази тази нощ" })).toBeEnabled();
  });

  it("allows the witch to target herself with either potion", () => {
    renderPanel({ privateRole: "witch", selectedTargetId: "u1" });

    expect(screen.getByText("Анна")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Лекувай" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Отрови" })).toBeEnabled();
  });

  it("disables a spent Witch potion and shows the private reason", () => {
    renderPanel({
      privateRole: "witch",
      selectedTargetId: "u2",
      nightActionCapabilities: {
        availableKinds: ["witch_heal"],
        usedFlags: {
          witch_poison: { reasonBg: "Отровата вече е използвана." },
        },
        disallowedTargetsByKind: {},
      },
    });

    expect(screen.getByRole("button", { name: "Лекувай" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Отрови" })).toBeDisabled();
    expect(screen.getByText("Отровата вече е използвана.")).toBeInTheDocument();
  });

  it("allows Witch healing only for the private faction victim", () => {
    renderPanel({
      privateRole: "witch",
      selectedTargetId: "u2",
      nightActionCapabilities: {
        availableKinds: ["witch_heal", "witch_poison"],
        usedFlags: {},
        disallowedTargetsByKind: {},
        allowedTargetIdsByKind: {
          witch_heal: ["u1"],
        },
      },
    });

    expect(screen.getByRole("button", { name: "Лекувай" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Отрови" })).toBeEnabled();
  });

  it("removes a disallowed Healer repeat target and shows the private reason", () => {
    renderPanel({
      privateRole: "healer",
      selectedTargetId: "u2",
      nightActionCapabilities: {
        availableKinds: ["healer_protect"],
        usedFlags: {},
        disallowedTargetsByKind: {
          healer_protect: [{
            id: "u2",
            reasonBg: "Не можеш да лекуваш същия играч две нощи поред.",
          }],
        },
      },
    });

    expect(screen.getByText("избери място")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Пази тази нощ" })).toBeDisabled();
    expect(screen.getByText("Не можеш да лекуваш същия играч две нощи поред.")).toBeInTheDocument();
  });

  it("disables an allied faction target and shows the private Bulgarian reason", () => {
    renderPanel({
      privateRole: "mafioso",
      selectedTargetId: "u2",
      privateFactionRoster: {
        faction: "mafia",
        members: [{ userId: "u2", displayName: "Борис" }],
      },
      nightActionCapabilities: {
        availableKinds: ["faction_kill"],
        usedFlags: {},
        disallowedTargetsByKind: {
          faction_kill: [{ id: "u2", reasonBg: "Не можеш да избереш свой съотборник." }],
        },
      },
    });

    expect(screen.getByText(/Твои съотборници:/)).toBeInTheDocument();
    expect(screen.getByText("Борис")).toBeInTheDocument();
    expect(screen.getByText("избери място")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Потвърди жертва" })).toBeDisabled();
    expect(screen.getByText("Не можеш да избереш свой съотборник.")).toBeInTheDocument();
  });

  it.each([
    ["don", "check_commissioner", "Търси Комисаря"],
    ["informant", "check_role", "Отвори досие"],
    ["lawyer", "lawyer_cover", "Подготви алиби"],
  ] as const)("keeps the %s special action enabled when faction kill is disabled", (role, specialKind, buttonName) => {
    renderPanel({
      privateRole: role,
      phase: "first_night",
      selectedTargetId: "u2",
      nightActionCapabilities: {
        availableKinds: [specialKind],
        usedFlags: {
          faction_kill: { reasonBg: "Убийствата са изключени през тази нощ." },
        },
        disallowedTargetsByKind: {},
      },
    });

    expect(screen.getByRole("button", { name: "Потвърди жертва" })).toBeDisabled();
    expect(screen.getByRole("button", { name: buttonName })).toBeEnabled();
    expect(screen.getByText("Убийствата са изключени през тази нощ.")).toBeInTheDocument();
  });

  it("does not treat the Blacksmith actor as a valid sword receiver", () => {
    renderPanel({ privateRole: "blacksmith", selectedTargetId: "u2", secondTargetId: "u1" });

    expect(screen.getByText("избери второ място")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Изкови меч" })).toBeDisabled();
  });
});
