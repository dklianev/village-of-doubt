import {
  createGameConfigFromOptions,
  createRoomOptionsFromConfig,
  type CreateRoomOptions,
  type RepeatRoomSettingsState,
} from "@werewolf/shared";

export function nextRoomOptionsForState(
  state: RepeatRoomSettingsState,
  previous?: CreateRoomOptions,
): CreateRoomOptions | undefined {
  if (!state.nextRoomOptionsJson) return undefined;
  try {
    const value: unknown = JSON.parse(state.nextRoomOptionsJson);
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    const record = value as Record<string, unknown>;
    if (typeof record.mode !== "string" || typeof record.playerCount !== "number"
      || !record.roles || !record.customTimers) return undefined;
    const config = createGameConfigFromOptions(record);
    const options = createRoomOptionsFromConfig(config);
    // The config normalizer labels explicit counts as manual, but the server's
    // validated preset identity remains useful when reopening the setup form.
    if (record.rolePreset !== undefined) {
      options.rolePreset = record.rolePreset as NonNullable<CreateRoomOptions["rolePreset"]>;
    }
    return previous && JSON.stringify(previous) === JSON.stringify(options) ? previous : options;
  } catch {
    return undefined;
  }
}
