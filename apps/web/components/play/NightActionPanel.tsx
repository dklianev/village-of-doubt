import type { NightActionCommand, RoleCode } from "@werewolf/shared";
import { nightActionHelpBg, nightInstructionBg } from "@/lib/play/copy";
import { canFactionKill } from "@/lib/play/role-rules";
import type { PublicPlayer } from "@/lib/play/types";

export function NightActionPanel({
  players,
  livingPlayers,
  phase,
  privateRole,
  selectedTargetId,
  secondTargetId,
  sendNightAction,
}: {
  players: PublicPlayer[];
  livingPlayers: PublicPlayer[];
  phase: string;
  privateRole: RoleCode;
  selectedTargetId: string;
  secondTargetId: string;
  sendNightAction: (action: NightActionCommand) => void;
}) {
  const selectableTargets =
    privateRole === "medium"
      ? players.filter((player) => player.playing && !player.alive)
      : livingPlayers;
  const selectedTargetStillAvailable = selectableTargets.some((player) => player.userId === selectedTargetId);
  const targetId = selectedTargetStillAvailable ? selectedTargetId : "";
  const selectedTarget = selectableTargets.find((player) => player.userId === targetId);
  const needsSecondTarget =
    privateRole === "blacksmith"
    || ((privateRole === "cupid" || privateRole === "lovers") && phase === "first_night");
  const secondTarget = livingPlayers.find((player) => player.userId === secondTargetId && player.userId !== targetId);
  const secondId = secondTarget?.userId ?? "";
  const canSubmitTarget = Boolean(targetId) && (!needsSecondTarget || Boolean(secondId));
  const secondTargetLabel = privateRole === "blacksmith" ? "кой получава меча" : "втора цел";

  return (
    <section className="night-action-sheet ritual-panel mt-8 rounded-[2rem] p-6">
      <p className="section-kicker">нощно действие</p>
      <h2 className="mt-2 text-3xl font-black">{nightInstructionBg(privateRole)}</h2>
      <p className="mt-3 text-[#ead9ba]">{nightActionHelpBg(privateRole)}</p>
      <p className="mt-2 text-sm font-bold text-[#c18a38]">
        Можеш да промениш избора си до края на таймера. Сървърът пази последното изпратено действие.
      </p>
      {privateRole === "medium" && selectableTargets.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-[#c18a38]/35 bg-[#c18a38]/10 p-3 text-sm font-bold text-[#ead9ba]">
          Медиумът няма елиминиран играч, с когото да се свърже тази нощ.
        </p>
      ) : null}

      <div className="play-selected-targets mt-5">
        <div className="play-selected-target">
          <span>цел от масата</span>
          <strong>{selectedTarget?.displayName ?? "избери място"}</strong>
        </div>
        {needsSecondTarget ? (
          <div className="play-selected-target">
            <span>{secondTargetLabel}</span>
            <strong>{secondTarget?.displayName ?? "избери второ място"}</strong>
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {canFactionKill(privateRole) ? (
          <button
            className={`btn btn-primary action-btn ${privateRole === "vampire" ? "ability-vampire" : "ability-kill"}`}
            type="button"
            disabled={!targetId}
            onClick={() => targetId && sendNightAction({ kind: "faction_kill", targetUserId: targetId })}
          >
            Потвърди жертва
          </button>
        ) : null}
        {privateRole === "commissioner" ? (
          <button className="btn btn-primary action-btn ability-investigate" type="button" disabled={!targetId} onClick={() => targetId && sendNightAction({ kind: "check_alignment", targetUserId: targetId })}>
            Провери дали е от Мафията
          </button>
        ) : null}
        {privateRole === "detective" ? (
          <button className="btn btn-primary action-btn ability-investigate" type="button" disabled={!targetId} onClick={() => targetId && sendNightAction({ kind: "check_alignment", targetUserId: targetId })}>
            Разследвай целта
          </button>
        ) : null}
        {privateRole === "informant" ? (
          <button className="btn btn-primary action-btn ability-investigate" type="button" disabled={!targetId} onClick={() => targetId && sendNightAction({ kind: "check_role", targetUserId: targetId })}>
            Отвори досие
          </button>
        ) : null}
        {privateRole === "roleblocker" ? (
          <button className="btn btn-primary action-btn ability-kill-alt" type="button" disabled={!targetId} onClick={() => targetId && sendNightAction({ kind: "roleblock", targetUserId: targetId })}>
            Блокирай действие
          </button>
        ) : null}
        {privateRole === "lawyer" ? (
          <button className="btn btn-secondary action-btn ability-bless" type="button" disabled={!targetId} onClick={() => targetId && sendNightAction({ kind: "lawyer_cover", targetUserId: targetId })}>
            Подготви алиби
          </button>
        ) : null}
        {privateRole === "medium" ? (
          <button className="btn btn-primary action-btn ability-investigate" type="button" disabled={!targetId} onClick={() => targetId && sendNightAction({ kind: "medium_contact", targetUserId: targetId })}>
            Свържи се с елиминиран
          </button>
        ) : null}
        {privateRole === "don" ? (
          <button className="btn btn-secondary action-btn ability-investigate" type="button" disabled={!targetId} onClick={() => targetId && sendNightAction({ kind: "check_commissioner", targetUserId: targetId })}>
            Търси Комисаря
          </button>
        ) : null}
        {privateRole === "seer" || privateRole === "oracle" ? (
          <button className="btn btn-primary action-btn ability-investigate" type="button" disabled={!targetId} onClick={() => targetId && sendNightAction({ kind: "check_role", targetUserId: targetId })}>
            Провери заплахата
          </button>
        ) : null}
        {privateRole === "investigator" ? (
          <button className="btn btn-primary action-btn ability-investigate" type="button" disabled={!targetId} onClick={() => targetId && sendNightAction({ kind: "investigator_check", targetUserId: targetId })}>
            Провери тройка
          </button>
        ) : null}
        {privateRole === "witch" ? (
          <>
            <button className="btn btn-secondary action-btn ability-heal" type="button" disabled={!targetId} onClick={() => targetId && sendNightAction({ kind: "witch_heal", targetUserId: targetId })}>
              Лекувай
            </button>
            <button className="btn btn-primary action-btn ability-kill" type="button" disabled={!targetId} onClick={() => targetId && sendNightAction({ kind: "witch_poison", targetUserId: targetId })}>
              Отрови
            </button>
          </>
        ) : null}
        {privateRole === "healer" || privateRole === "doctor" || privateRole === "bodyguard" ? (
          <button className="btn btn-primary action-btn ability-heal" type="button" disabled={!targetId} onClick={() => targetId && sendNightAction({ kind: "healer_protect", targetUserId: targetId })}>
            Пази тази нощ
          </button>
        ) : null}
        {privateRole === "priest" ? (
          <button className="btn btn-primary action-btn ability-bless" type="button" disabled={!targetId} onClick={() => targetId && sendNightAction({ kind: "priest_bless", targetUserId: targetId })}>
            Дай благословия
          </button>
        ) : null}
        {privateRole === "blacksmith" ? (
          <button
            className="btn btn-primary action-btn ability-kill"
            type="button"
            disabled={!canSubmitTarget}
            onClick={() => targetId && secondId && sendNightAction({ kind: "blacksmith_sword", receiverUserId: secondId, targetUserId: targetId })}
          >
            Изкови меч
          </button>
        ) : null}
        {privateRole === "stray_cat" ? (
          <button className="btn btn-primary action-btn ability-investigate" type="button" disabled={!targetId} onClick={() => targetId && sendNightAction({ kind: "stray_cat_choose", targetUserId: targetId })}>
            Избери дом
          </button>
        ) : null}
        {privateRole === "thief" && phase === "first_night" ? (
          <button className="btn btn-primary action-btn ability-steal" type="button" disabled={!targetId} onClick={() => targetId && sendNightAction({ kind: "thief_steal", targetUserId: targetId })}>
            Открадни карта
          </button>
        ) : null}
        {(privateRole === "cupid" || privateRole === "lovers") && phase === "first_night" ? (
          <button
            className="btn btn-primary action-btn ability-lovers"
            type="button"
            disabled={!canSubmitTarget}
            onClick={() => targetId && secondId && sendNightAction({ kind: "cupid_link", firstUserId: targetId, secondUserId: secondId })}
          >
            Свържи Влюбените
          </button>
        ) : null}
        <button className="btn btn-secondary" type="button" onClick={() => sendNightAction({ kind: "skip" })}>
          Пропусни
        </button>
      </div>
    </section>
  );
}
