import { useEffect, useState } from "react";
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

  return (
    <section
      className={`night-action-sheet ritual-panel ${styles.sheet}`}
      aria-label="Нощен команден ритуал"
      data-command-state={canSubmitTarget ? "ready" : "awaiting-target"}
    >
      <div className={styles.commandHeader}>
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
          <button
            className={`btn btn-primary action-btn ${privateRole === "vampire" ? "ability-vampire" : "ability-kill"}`}
            data-command-priority="primary"
            type="button"
            disabled={!targetId || !canUseKind("faction_kill")}
            onClick={() => targetId && sendNightAction({ kind: "faction_kill", targetUserId: targetId })}
          >
            Потвърди жертва
          </button>
        ) : null}
        {privateRole === "commissioner" ? (
          <button className="btn btn-primary action-btn ability-investigate" data-command-priority="primary" type="button" disabled={!targetId || !canUseKind("check_alignment")} onClick={() => targetId && sendNightAction({ kind: "check_alignment", targetUserId: targetId })}>
            Провери дали е от Мафията
          </button>
        ) : null}
        {privateRole === "detective" ? (
          <button className="btn btn-primary action-btn ability-investigate" data-command-priority="primary" type="button" disabled={!targetId || !canUseKind("check_alignment")} onClick={() => targetId && sendNightAction({ kind: "check_alignment", targetUserId: targetId })}>
            Разследвай целта
          </button>
        ) : null}
        {privateRole === "informant" ? (
          <button className="btn btn-primary action-btn ability-investigate" data-command-priority="primary" type="button" disabled={!targetId || !canUseKind("check_role")} onClick={() => targetId && sendNightAction({ kind: "check_role", targetUserId: targetId })}>
            Отвори досие
          </button>
        ) : null}
        {privateRole === "roleblocker" ? (
          <button className="btn btn-primary action-btn ability-kill-alt" data-command-priority="primary" type="button" disabled={!targetId || !canUseKind("roleblock")} onClick={() => targetId && sendNightAction({ kind: "roleblock", targetUserId: targetId })}>
            Блокирай действие
          </button>
        ) : null}
        {privateRole === "lawyer" ? (
          <button className="btn btn-secondary action-btn ability-bless" data-command-priority="primary" type="button" disabled={!targetId || !canUseKind("lawyer_cover")} onClick={() => targetId && sendNightAction({ kind: "lawyer_cover", targetUserId: targetId })}>
            Подготви алиби
          </button>
        ) : null}
        {privateRole === "medium" ? (
          <button className="btn btn-primary action-btn ability-investigate" data-command-priority="primary" type="button" disabled={!targetId || !canUseKind("medium_contact")} onClick={() => targetId && sendNightAction({ kind: "medium_contact", targetUserId: targetId })}>
            Свържи се с елиминиран
          </button>
        ) : null}
        {privateRole === "don" ? (
          <button className="btn btn-secondary action-btn ability-investigate" data-command-priority="primary" type="button" disabled={!targetId || !canUseKind("check_commissioner")} onClick={() => targetId && sendNightAction({ kind: "check_commissioner", targetUserId: targetId })}>
            Търси Комисаря
          </button>
        ) : null}
        {privateRole === "seer" || privateRole === "oracle" ? (
          <button className="btn btn-primary action-btn ability-investigate" data-command-priority="primary" type="button" disabled={!targetId || !canUseKind("check_role")} onClick={() => targetId && sendNightAction({ kind: "check_role", targetUserId: targetId })}>
            Провери заплахата
          </button>
        ) : null}
        {privateRole === "investigator" ? (
          <button className="btn btn-primary action-btn ability-investigate" data-command-priority="primary" type="button" disabled={!targetId || !canUseKind("investigator_check")} onClick={() => targetId && sendNightAction({ kind: "investigator_check", targetUserId: targetId })}>
            Провери тройка
          </button>
        ) : null}
        {privateRole === "witch" ? (
          <>
            <button className="btn btn-secondary action-btn ability-heal" data-command-priority="primary" type="button" disabled={!targetId || !canUseKind("witch_heal")} onClick={() => targetId && sendNightAction({ kind: "witch_heal", targetUserId: targetId })}>
              Лекувай
            </button>
            <button className="btn btn-primary action-btn ability-kill" data-command-priority="primary" type="button" disabled={!targetId || !canUseKind("witch_poison")} onClick={() => targetId && sendNightAction({ kind: "witch_poison", targetUserId: targetId })}>
              Отрови
            </button>
          </>
        ) : null}
        {privateRole === "healer" || privateRole === "doctor" || privateRole === "bodyguard" ? (
          <button className="btn btn-primary action-btn ability-heal" data-command-priority="primary" type="button" disabled={!targetId || !canUseKind("healer_protect")} onClick={() => targetId && sendNightAction({ kind: "healer_protect", targetUserId: targetId })}>
            Пази тази нощ
          </button>
        ) : null}
        {privateRole === "priest" ? (
          <button className="btn btn-primary action-btn ability-bless" data-command-priority="primary" type="button" disabled={!targetId || !canUseKind("priest_bless")} onClick={() => targetId && sendNightAction({ kind: "priest_bless", targetUserId: targetId })}>
            Дай благословия
          </button>
        ) : null}
        {privateRole === "blacksmith" ? (
          <button
            className="btn btn-primary action-btn ability-kill"
            data-command-priority="primary"
            type="button"
            disabled={!canSubmitTarget || !canUseKind("blacksmith_sword")}
            onClick={() => targetId && secondId && sendNightAction({ kind: "blacksmith_sword", receiverUserId: secondId, targetUserId: targetId })}
          >
            Изкови меч
          </button>
        ) : null}
        {privateRole === "stray_cat" ? (
          <button className="btn btn-primary action-btn ability-investigate" data-command-priority="primary" type="button" disabled={!targetId || !canUseKind("stray_cat_choose")} onClick={() => targetId && sendNightAction({ kind: "stray_cat_choose", targetUserId: targetId })}>
            Избери дом
          </button>
        ) : null}
        {privateRole === "thief" && phase === "first_night" ? (
          <button className="btn btn-primary action-btn ability-steal" data-command-priority="primary" type="button" disabled={!targetId || !canUseKind("thief_steal")} onClick={() => targetId && sendNightAction({ kind: "thief_steal", targetUserId: targetId })}>
            Открадни карта
          </button>
        ) : null}
        {(privateRole === "cupid" || privateRole === "lovers") && phase === "first_night" ? (
          <button
            className="btn btn-primary action-btn ability-lovers"
            data-command-priority="primary"
            type="button"
            disabled={!canSubmitTarget || !canUseKind("cupid_link")}
            onClick={() => targetId && secondId && sendNightAction({ kind: "cupid_link", firstUserId: targetId, secondUserId: secondId })}
          >
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
      <p className={`night-action-help ${styles.help}`}>{nightActionHelpBg(privateRole)}</p>
      {unavailableReasons.length > 0 ? (
        <div className={`night-action-reasons ${styles.reasons}`}>
          {unavailableReasons.map((reason) => (
            <p key={reason}>{reason}</p>
          ))}
        </div>
      ) : null}
      <p className={`night-action-server-note ${styles.serverNote}`}>
        Можеш да промениш избора си до края на таймера. Зачита се последното изпратено действие.
      </p>
      {privateRole === "medium" && selectableTargets.length === 0 ? (
        <p className={`night-action-empty-note ${styles.emptyNote}`}>
          Медиумът няма елиминиран играч, с когото да се свърже тази нощ.
        </p>
      ) : null}
    </section>
  );
}
