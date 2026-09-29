import type { PublicArchiveFamily, PublicArchiveOutcome } from "@werewolf/database";

export const ARCHIVE_PAGE_SIZE = 12;
export const ARCHIVE_FAMILIES = [
  { value: "all", label: "Всички игри" },
  { value: "werewolves", label: "Върколак" },
  { value: "mafia", label: "Мафия" },
] as const;
export const ARCHIVE_OUTCOMES = [
  { value: "all", label: "Всички развръзки" },
  { value: "village", label: "Селото / Градът" },
  { value: "werewolves", label: "Върколаците" },
  { value: "mafia", label: "Мафията" },
  { value: "vampires", label: "Вампирите" },
  { value: "maniac", label: "Маниакът" },
  { value: "lovers", label: "Влюбените" },
  { value: "draw", label: "Равенство" },
  { value: "unknown", label: "Не е записан" },
] as const;

export interface ArchiveSelection {
  family: PublicArchiveFamily;
  outcome: PublicArchiveOutcome;
  before?: string;
  after?: string;
}

type SearchParams = Record<string, string | string[] | undefined>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function firstSearchValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseArchiveSelection(params: SearchParams = {}): ArchiveSelection {
  const family = firstSearchValue(params.family);
  const outcome = firstSearchValue(params.outcome);
  const before = firstSearchValue(params.before);
  const after = firstSearchValue(params.after);
  return {
    family: ARCHIVE_FAMILIES.find((item) => item.value === family)?.value ?? "all",
    outcome: ARCHIVE_OUTCOMES.find((item) => item.value === outcome)?.value ?? "all",
    ...(before && UUID.test(before) ? { before } : after && UUID.test(after) ? { after } : {}),
  };
}

export function archiveHref(selection: ArchiveSelection, visualHistory?: string): string {
  const params = new URLSearchParams();
  if (selection.family !== "all") params.set("family", selection.family);
  if (selection.outcome !== "all") params.set("outcome", selection.outcome);
  if (selection.before) params.set("before", selection.before);
  else if (selection.after) params.set("after", selection.after);
  if (visualHistory) params.set("visualHistory", visualHistory);
  const query = params.toString();
  return `/history${query ? `?${query}` : ""}`;
}
