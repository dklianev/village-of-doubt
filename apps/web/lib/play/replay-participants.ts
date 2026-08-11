import { getRoleNameBg, type RoleCode } from "@werewolf/shared";

export type ReplayParticipantRow = {
  userId: string;
  displayName: string;
  role: string | null;
};

type ReplayParticipantEvent = {
  actorId: string | null;
  targetId: string | null;
  payload: unknown;
};

export type ReplayParticipant = {
  id: string;
  label: string;
  role: string | undefined;
  initial: string;
};

export function collectReplayParticipants(
  persistedPlayers: readonly ReplayParticipantRow[],
  events: readonly ReplayParticipantEvent[],
  rolesVisible: boolean,
): ReplayParticipant[] {
  const participants = new Map<string, ReplayParticipant>();

  for (const player of persistedPlayers) {
    upsertParticipant(
      participants,
      player.userId,
      player.displayName,
      rolesVisible ? roleNameFromCode(player.role ?? undefined) : undefined,
    );
  }

  for (const event of events) {
    const payload = payloadRecord(event.payload);
    const actorName = stringValue(payload.actorNameBg) ?? stringValue(payload.actorName) ?? stringValue(payload.displayName);
    const targetName = stringValue(payload.targetNameBg) ?? stringValue(payload.targetName);
    const actorRole = rolesVisible
      ? stringValue(payload.roleNameBg) ?? roleNameFromCode(stringValue(payload.role))
      : undefined;

    if (event.actorId) {
      upsertParticipant(participants, event.actorId, actorName, actorRole);
    }
    if (event.targetId) {
      upsertParticipant(participants, event.targetId, targetName, undefined);
    }
    if (!event.actorId && actorName) {
      upsertParticipant(participants, actorName, actorName, actorRole);
    }
    if (!event.targetId && targetName) {
      upsertParticipant(participants, targetName, targetName, undefined);
    }
  }

  return [...participants.values()];
}

function upsertParticipant(
  participants: Map<string, ReplayParticipant>,
  id: string,
  label: string | undefined,
  role: string | undefined,
) {
  const fallbackLabel = shortId(id);
  const nextLabel = label ?? fallbackLabel;
  const existing = participants.get(id);
  const resolvedLabel = existing?.label && existing.label !== fallbackLabel ? existing.label : nextLabel;
  participants.set(id, {
    id,
    label: resolvedLabel,
    role: existing?.role ?? role,
    initial: initialFor(resolvedLabel),
  });
}

function payloadRecord(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function roleNameFromCode(role: string | undefined) {
  if (!role) {
    return undefined;
  }
  try {
    return getRoleNameBg(role as RoleCode);
  } catch {
    return role;
  }
}

function shortId(id: string) {
  return id.length > 8 ? `играч ${id.slice(0, 4)}` : id;
}

function initialFor(label: string) {
  return label.trim().charAt(0).toLocaleUpperCase("bg-BG") || "И";
}
