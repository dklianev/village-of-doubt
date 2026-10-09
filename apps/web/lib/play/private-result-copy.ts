import { ROLE_DEFINITIONS } from "@werewolf/shared";
import type { PrivateResult, PublicPlayer } from "@/lib/play/types";

export function formatPrivateResult(result: PrivateResult, players: PublicPlayer[]) {
  const nameFor = (userId: string) => players.find((player) => player.userId === userId)?.displayName ?? "избрания играч";
  const targetName = nameFor(result.targetUserId);
  const groupNames = result.targetUserIds && result.targetUserIds.length > 1
    ? result.targetUserIds.map(nameFor).join(", ")
    : null;

  if (result.messageBg) {
    if (groupNames) {
      return `Проверката е за групата ${groupNames}. ${result.messageBg}`;
    }
    return result.targetUserId ? `Проверката е за ${targetName}. ${result.messageBg}` : result.messageBg;
  }

  if (groupNames) {
    return `Имаш резултат за групата ${groupNames}.`;
  }
  if (result.role) {
    return `${targetName} е ${ROLE_DEFINITIONS[result.role].nameBg}.`;
  }
  if (typeof result.isEvil === "boolean") {
    return result.isEvil ? `${targetName} е от злата страна.` : `${targetName} не е от злата страна.`;
  }
  if (typeof result.isCommissioner === "boolean") {
    return result.isCommissioner ? `${targetName} е Комисарят.` : `${targetName} не е Комисарят.`;
  }

  return `Имаш резултат за ${targetName}.`;
}
