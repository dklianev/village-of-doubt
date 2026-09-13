import { useEffect, useState } from "react";
import { Ban, FileSearch, Hammer, Hand, Heart, HeartPulse, House, Search, ShieldCheck, Skull, type LucideIcon } from "lucide-react";
import type { GamePhase, NightActionCapabilities, NightActionCommand, NightActionKind, PrivateFactionRoster, RoleCode } from "@werewolf/shared";
import { nightActionHelpBg, nightInstructionBg } from "@/lib/play/copy";
import { canFactionKill } from "@/lib/play/role-rules";
import {
  canUseNightKindForTarget,
  isNightActionKindAvailable,
  needsSecondNightTarget,
  nightActionUnavailableReasons,
  secondaryShortcutTargets,
  shortcutTargets,
  targetKindsForRole,
} from "@/lib/play/night-actions";
import type { PublicPlayer } from "@/lib/play/types";
import styles from "./NightActionPanel.module.css";

export function NightActionPanel({
  players,
  livingPlayers,
  currentUserId,
  doctorCanSelfProtect,
  phase,
  privateRole,
  privateFactionRoster,
  nightActionCapabilities,
  selectedTargetId,
  secondTargetId,
  onResetPrimaryTarget,
  sendNightAction,
}: {
  players: PublicPlayer[];
  livingPlayers: PublicPlayer[];
  currentUserId: string;
  doctorCanSelfProtect: boolean;
  phase: GamePhase;
  privateRole: RoleCode;
  privateFactionRoster?: PrivateFactionRoster | null;
  nightActionCapabilities?: NightActionCapabilities | null;
  selectedTargetId: string;
  secondTargetId: string;
  onResetPrimaryTarget: () => void;
  sendNightAction: (action: NightActionCommand) => void;
}) {
  const [skipArmed, setSkipArmed] = useState(false);
  const supportsCombinedActions = ["witch", "don", "lawyer", "informant"].includes(privateRole);
  const selectableTargets = shortcutTargets(phase, privateRole, players, livingPlayers, currentUserId, {
    doctorCanSelfProtect,
    nightActionCapabilities,
  });
  const selectedTargetStillAvailable = selectableTargets.some((player) => player.userId === selectedTargetId);
  const targetId = selectedTargetStillAvailable ? selectedTargetId : "";
  const selectedTarget = selectableTargets.find((player) => player.userId === targetId);
  const needsSecondTarget = needsSecondNightTarget(privateRole, phase);
  const secondaryTargets = needsSecondTarget
    ? secondaryShortcutTargets(phase, privateRole, livingPlayers, currentUserId, targetId, {
      nightActionCapabilities,
    })
    : [];
  const secondTarget = secondaryTargets.find((player) => player.userId === secondTargetId);
  const secondId = secondTarget?.userId ?? "";
  const canSubmitTarget = Boolean(targetId) && (!needsSecondTarget || Boolean(secondId));
  const secondTargetLabel = privateRole === "blacksmith" ? "кой получава меча" : "втора цел";
  const selectionStep = targetId ? 2 : 1;
  const unavailableReasons = nightActionUnavailableReasons(
    nightActionCapabilities,
    targetKindsForRole(privateRole, phase),
  );
  const canUseKind = (kind: NightActionKind) =>
    isNightActionKindAvailable(nightActionCapabilities, kind)
    && canUseNightKindForTarget(kind, targetId, nightActionCapabilities);

  useEffect(() => {
    setSkipArmed(false);
  }, [phase, secondTargetId, selectedTargetId]);

  function submitTargetAction(action: NightActionCommand) {
    setSkipArmed(false);
    sendNightAction(action);
  }

  function targetActionButton(
    kind: Exclude<NightActionKind, "skip" | "cupid_link" | "blacksmith_sword">,
    label: string,
    Icon: LucideIcon,
    ability: string,
    secondary = false,
  ) {
    return (
      <button
        className={`btn btn-${secondary ? "secondary" : "primary"} action-btn ability-${ability}`}
        data-command-priority="primary"
        type="button"
        disabled={!targetId || !canUseKind(kind)}
        onClick={() => targetId && submitTargetAction({ kind, targetUserId: targetId })}
      >
        <Icon className="play-button-icon" aria-hidden="true" />
        {label}
      </button>
    );
  }

  return (
    <section
      className={`night-action-sheet ritual-panel ${styles.sheet}`}
      aria-label="Нощен команден ритуал"
      data-command-state={canSubmitTarget ? "ready" : "awaiting-target"}
    >
      <div className={`night-action-description ${styles.commandHeader}`}>
        <p className={`section-kicker ${styles.kicker}`}>нощно действие</p>
        <h2>{nightInstructionBg(privateRole)}</h2>
      </div>
      {privateFactionRoster && privateFactionRoster.members.length > 0 ? (
        <p className={`night-action-allies ${styles.allies}`}>
          <strong>Твои съотборници:</strong>{" "}
          {privateFactionRoster.members.map((member) => member.displayName).join(", ")}
        </p>
      ) : null}
      {needsSecondTarget ? (
        <p className={`night-action-step ${styles.step}`} aria-live="polite">
          Стъпка {selectionStep} от 2
        </p>
      ) : null}
      <div
        className={`play-selected-targets ${styles.selectedTargets}`}
        role="group"
        aria-label="Избрана цел"
        data-selection-state={selectedTarget && (!needsSecondTarget || secondTarget) ? "ready" : "empty"}
      >
        <div className={`play-selected-target ${styles.selectedTarget}`} data-filled={selectedTarget ? "true" : undefined}>
          <span>{needsSecondTarget ? "първа цел" : "цел от масата"}</span>
          <strong>{selectedTarget?.displayName ?? "избери място"}</strong>
        </div>
        {needsSecondTarget ? (
          <div className={`play-selected-target ${styles.selectedTarget}`} data-filled={secondTarget ? "true" : undefined}>
            <span>{secondTargetLabel}</span>
            <strong>{secondTarget?.displayName ?? "избери второ място"}</strong>
          </div>
        ) : null}
      </div>

      {needsSecondTarget && selectedTarget ? (
        <button className={`btn btn-secondary ${styles.resetButton}`} type="button" onClick={onResetPrimaryTarget}>
          Промени първата цел
        </button>
      ) : null}

      <div className={`play-action-buttons ${styles.actions}`} role="group" aria-label="Действия за тази нощ">
        {canFactionKill(privateRole) ? (
          targetActionButton("faction_kill", "Потвърди жертва", Skull, privateRole === "vampire" ? "vampire" : "kill")
        ) : null}
        {privateRole === "commissioner" ? (
          targetActionButton("check_alignment", "Провери дали е от Мафията", Search, "investigate")
        ) : null}
        {privateRole === "detective" ? (
          targetActionButton("check_alignment", "Разследвай целта", Search, "investigate")
        ) : null}
        {privateRole === "informant" ? (
          targetActionButton("check_role", "Отвори досие", FileSearch, "investigate")
        ) : null}
        {privateRole === "roleblocker" ? (
          targetActionButton("roleblock", "Блокирай действие", Ban, "kill-alt")
        ) : null}
        {privateRole === "lawyer" ? (
          targetActionButton("lawyer_cover", "Подготви алиби", ShieldCheck, "bless", true)
        ) : null}
        {privateRole === "medium" ? (
          targetActionButton("medium_contact", "Свържи се с елиминиран", Search, "investigate")
        ) : null}
        {privateRole === "don" ? (
          targetActionButton("check_commissioner", "Търси Комисаря", Search, "investigate", true)
        ) : null}
        {privateRole === "seer" || privateRole === "oracle" ? (
          targetActionButton("check_role", "Провери заплахата", Search, "investigate")
        ) : null}
        {privateRole === "investigator" ? (
          targetActionButton("investigator_check", "Провери тройка", Search, "investigate")
        ) : null}
        {privateRole === "witch" ? (
          <>
            {targetActionButton("witch_heal", "Лекувай", HeartPulse, "heal", true)}
            {targetActionButton("witch_poison", "Отрови", Skull, "kill")}
          </>
        ) : null}
        {privateRole === "healer" || privateRole === "doctor" || privateRole === "bodyguard" ? (
          targetActionButton("healer_protect", "Пази тази нощ", ShieldCheck, "heal")
        ) : null}
        {privateRole === "priest" ? (
          targetActionButton("priest_bless", "Дай благословия", ShieldCheck, "bless")
        ) : null}
        {privateRole === "blacksmith" ? (
          <button
            className="btn btn-primary action-btn ability-kill"
            data-command-priority="primary"
            type="button"
            disabled={!canSubmitTarget || !canUseKind("blacksmith_sword")}
            onClick={() => targetId && secondId && submitTargetAction({ kind: "blacksmith_sword", receiverUserId: secondId, targetUserId: targetId })}
          >
            <Hammer className="play-button-icon" aria-hidden="true" />
            Изкови меч
          </button>
        ) : null}
        {privateRole === "stray_cat" ? (
          targetActionButton("stray_cat_choose", "Избери дом", House, "investigate")
        ) : null}
        {privateRole === "thief" && phase === "first_night" ? (
          targetActionButton("thief_steal", "Открадни карта", Hand, "steal")
        ) : null}
        {(privateRole === "cupid" || privateRole === "lovers") && phase === "first_night" ? (
          <button
            className="btn btn-primary action-btn ability-lovers"
            data-command-priority="primary"
            type="button"
            disabled={!canSubmitTarget || !canUseKind("cupid_link")}
            onClick={() => targetId && secondId && submitTargetAction({ kind: "cupid_link", firstUserId: targetId, secondUserId: secondId })}
          >
            <Heart className="play-button-icon" aria-hidden="true" />
            Свържи Влюбените
          </button>
        ) : null}
        <button
          className={`btn btn-secondary play-confirm-skip ${styles.skipButton}`}
          data-command-priority="quiet"
          data-confirm-state={skipArmed ? "armed" : "idle"}
          type="button"
          aria-pressed={skipArmed}
          onClick={() => {
            if (skipArmed) {
              setSkipArmed(false);
              sendNightAction({ kind: "skip" });
              return;
            }
            setSkipArmed(true);
          }}
        >
          {skipArmed ? "Потвърди пропуска" : "Пропусни"}
        </button>
      </div>
      {unavailableReasons.length > 0 ? (
        <div className={`night-action-reasons ${styles.reasons}`}>
          {unavailableReasons.map((reason) => (
            <p key={reason}>{reason}</p>
          ))}
        </div>
      ) : null}
      <details className="play-action-explanation">
        <summary>За този ход</summary>
        <p className={`night-action-help ${styles.help}`}>{nightActionHelpBg(privateRole)}</p>
        <p className={`night-action-server-note ${styles.serverNote}`}>
        {supportsCombinedActions
          ? "Докато фазата е отворена, можеш да променяш всяко действие отделно. Зачита се последното прието действие от всеки вид. Пропускането не отменя вече приетите действия."
          : "Докато фазата е отворена, можеш да променяш действието си. Зачита се последното прието действие."}
        </p>
      </details>
      {privateRole === "medium" && selectableTargets.length === 0 ? (
        <p className={`night-action-empty-note ${styles.emptyNote}`}>
          Медиумът няма елиминиран играч, с когото да се свърже тази нощ.
        </p>
      ) : null}
    </section>
  );
}
