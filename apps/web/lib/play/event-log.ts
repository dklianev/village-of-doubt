export function eventLineClass(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("ловец") || normalized.includes("изстрел") || normalized.includes("застрел")) {
    return "event-hunter-shot";
  }
  if (normalized.includes("умря") || normalized.includes("смърт") || normalized.includes("елимини")) {
    return "event-death";
  }
  if (normalized.includes("разкри") || normalized.includes("роля") || normalized.includes("провер")) {
    return "event-reveal";
  }
  return "event-generic";
}
