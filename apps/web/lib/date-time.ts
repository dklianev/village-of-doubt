export const BULGARIAN_TIME_ZONE = "Europe/Sofia";

export function formatBulgarianDateTime(
  value: Date | number,
  options: Readonly<Intl.DateTimeFormatOptions>,
): string {
  return new Intl.DateTimeFormat("bg-BG", {
    ...options,
    timeZone: BULGARIAN_TIME_ZONE,
  }).format(value);
}
